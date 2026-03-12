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
 * Preferred node resolution order for CAD workflows.
 * build_corrected (validated/corrected GLB) is preferred over build_initial (raw GLB).
 */
const CAD_NODE_PRIORITY = ['build_corrected', 'build_initial'] as const;

/**
 * Resolve the best available output from a workflow's steps array.
 * 
 * For CAD workflows, checks nodes in explicit priority order:
 *   1. build_corrected — use glb_artifact
 *   2. build_initial  — use original_glb_artifact
 * 
 * If build_corrected failed or has no result, silently falls back to build_initial.
 * For non-CAD workflows, falls back to generic last-node-backwards walk.
 * If none succeeded → return null.
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
      if (stepTime > existing.latestAt) {
        existing.latestAt = stepTime;
      }
      if (step.is_success) {
        const existingSeq = existing.bestSuccess?.attempt_seq ?? -1;
        const newSeq = step.attempt_seq ?? 0;
        if (!existing.bestSuccess || newSeq >= existingSeq) {
          existing.bestSuccess = step;
        }
      }
    }
  }

  if (nodeMap.size === 0) return null;

  // ── CAD-specific priority resolution ──
  // Check if any of the known CAD nodes exist in this workflow
  const hasCadNodes = CAD_NODE_PRIORITY.some(n => nodeMap.has(n));

  if (hasCadNodes) {
    // Walk the priority list: first match with a successful attempt wins
    for (const nodeName of CAD_NODE_PRIORITY) {
      const node = nodeMap.get(nodeName);
      if (node?.bestSuccess) {
        const isFallback = nodeName !== CAD_NODE_PRIORITY[0];
        return {
          step: node.bestSuccess,
          isFallback,
          // Silent fallback — no failedNodeName so no banner is shown
          failedNodeName: isFallback ? CAD_NODE_PRIORITY[0] : undefined,
        };
      }
    }
    // None of the CAD nodes succeeded
    return null;
  }

  // ── Generic fallback: last node backwards walk ──
  const orderedNodes = [...nodeMap.entries()].sort((a, b) =>
    a[1].latestAt.localeCompare(b[1].latestAt)
  );

  const [lastNodeId, lastNodeData] = orderedNodes[orderedNodes.length - 1];

  if (lastNodeData.bestSuccess) {
    return { step: lastNodeData.bestSuccess, isFallback: false };
  }

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

  return null;
}

/**
 * Get the effective output from a resolved step.
 * New API uses output_data, legacy uses output.
 */
export function getStepOutput(step: WorkflowStep): Record<string, unknown> {
  return step.output_data ?? step.output ?? {};
}
