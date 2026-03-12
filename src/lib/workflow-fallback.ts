/**
 * Workflow Node Fallback Resolution
 * 
 * Groups steps by node_instance_id, finds the last node (by created_at),
 * and walks backwards to find the best successful output.
 */

import type { WorkflowStep } from '@/lib/generation-history-api';

export interface ResolvedNode {
  /** The step whose output should be displayed */
  step: WorkflowStep;
  /** Whether this is a fallback (not the final node) */
  isFallback: boolean;
  /** Name of the final node that failed (only set when isFallback=true) */
  failedNodeName?: string;
}

/**
 * Resolve the best available output from a workflow's steps array.
 * 
 * 1. Group by node_instance_id, order nodes by latest created_at.
 * 2. Check if the last node has a successful attempt.
 * 3. If yes → return it (normal).
 * 4. If no → walk backwards and return the most recent successful node (fallback).
 * 5. If none succeeded → return null.
 */
export function resolveWorkflowOutput(steps: WorkflowStep[]): ResolvedNode | null {
  if (!steps?.length) return null;

  // Check if steps use the new schema (node_instance_id + is_success)
  const hasNewSchema = steps.some(s => s.node_instance_id != null && s.is_success != null);

  if (!hasNewSchema) {
    // Legacy steps — no fallback logic needed, return null to let caller use old logic
    return null;
  }

  // Group by node_instance_id, keeping best attempt per node
  const nodeMap = new Map<string, { bestSuccess: WorkflowStep | null; latestAt: string }>();

  for (const step of steps) {
    const nodeId = step.node_instance_id ?? step.tool ?? 'unknown';
    const existing = nodeMap.get(nodeId);
    const stepTime = step.created_at ?? step.at ?? '';

    if (!existing) {
      nodeMap.set(nodeId, {
        bestSuccess: step.is_success ? step : null,
        latestAt: stepTime,
      });
    } else {
      // Update latest timestamp
      if (stepTime > existing.latestAt) {
        existing.latestAt = stepTime;
      }
      // Track best successful attempt (highest attempt_seq)
      if (step.is_success) {
        const existingSeq = existing.bestSuccess?.attempt_seq ?? -1;
        const newSeq = step.attempt_seq ?? 0;
        if (!existing.bestSuccess || newSeq >= existingSeq) {
          existing.bestSuccess = step;
        }
      }
    }
  }

  // Sort nodes by latest created_at (chronological order)
  const orderedNodes = [...nodeMap.entries()].sort((a, b) =>
    a[1].latestAt.localeCompare(b[1].latestAt)
  );

  if (orderedNodes.length === 0) return null;

  // Check the last (final) node
  const [lastNodeId, lastNodeData] = orderedNodes[orderedNodes.length - 1];

  if (lastNodeData.bestSuccess) {
    // Normal case — last node succeeded
    return { step: lastNodeData.bestSuccess, isFallback: false };
  }

  // Walk backwards to find most recent successful node
  for (let i = orderedNodes.length - 2; i >= 0; i--) {
    const [, nodeData] = orderedNodes[i];
    if (nodeData.bestSuccess) {
      return {
        step: nodeData.bestSuccess,
        isFallback: true,
        failedNodeName: lastNodeId,
      };
    }
  }

  // No node succeeded at all
  return null;
}

/**
 * Get the effective output from a resolved step.
 * New API uses output_data, legacy uses output.
 */
export function getStepOutput(step: WorkflowStep): Record<string, unknown> {
  return step.output_data ?? step.output ?? {};
}
