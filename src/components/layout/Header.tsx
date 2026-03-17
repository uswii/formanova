import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import { Button } from '@/components/ui/button';
import { Menu, X, LogIn, LogOut, User, Image, BadgeCheck, ScanEye } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { useCredits } from '@/contexts/CreditsContext';
import { isCADEnabled } from '@/lib/feature-flags';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ThemeLogo } from '@/components/ThemeLogo';
import creditCoinIcon from '@/assets/icons/credit-coin.png';

export function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { credits, lastDelta } = useCredits();
  const isAdmin = useIsAdmin();
  const [visibleDelta, setVisibleDelta] = useState<{ amount: number; id: number } | null>(null);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const rafId = useRef<number | undefined>();
  useEffect(() => {
    const handleScroll = () => {
      if (rafId.current) return;
      rafId.current = requestAnimationFrame(() => {
        setIsScrolled(window.scrollY > 20);
        rafId.current = undefined;
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (rafId.current) cancelAnimationFrame(rafId.current);
    };
  }, []);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  // Show delta badge briefly when balance changes
  useEffect(() => {
    if (!lastDelta) return;
    setVisibleDelta(lastDelta);
    const timer = setTimeout(() => setVisibleDelta(null), 4000);
    return () => clearTimeout(timer);
  }, [lastDelta]);

  const cadEnabled = isCADEnabled(user?.email);

  const navLinks = [
    { path: '/', label: 'Home' },
    { path: '/studio', label: 'Photo Studio' },
    ...(cadEnabled ? [{ path: '/studio-cad', label: 'CAD Studio' }] : []),
    // { path: '/tutorial', label: 'Tutorial' }, // hidden for now
  ];

  return (
    <>
      <header 
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          isScrolled 
            ? 'bg-background border-b border-border/20' 
            : 'bg-background'
        }`}
      >
        <div className="flex h-16 lg:h-20 items-center justify-between px-4 md:px-8 lg:px-12">
          {/* Left side: Logo */}
          <div className="flex items-center">
            <ThemeLogo className="h-10 md:h-12 lg:h-14" />
          </div>

          {/* Right side: Theme Switcher (desktop only, next to nav) */}
          <div className="hidden lg:flex items-center gap-4">
            <ThemeSwitcher />
          </div>

          {/* Desktop Navigation - Marta Style */}
          <nav className="hidden lg:flex items-center gap-4 lg:gap-6 flex-nowrap">
            {navLinks.map((link) => (
              <Link 
                key={link.path}
                to={link.path}
                className={`text-sm font-medium transition-colors whitespace-nowrap ${
                  location.pathname === link.path 
                    ? 'text-foreground' 
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {link.label}
              </Link>
            ))}
            
            {/* User Profile / Auth Button */}
            {user ? (
              <div className="flex items-center gap-3">
                {/* Credit pill - clickable */}
                <div className="relative">
                  <Link
                    to="/credits"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border/40 hover:border-border transition-colors"
                  >
                    <img src={creditCoinIcon} alt="" className="h-7 w-7 object-contain" width={28} height={28} loading="eager" decoding="sync" />
                    <span className="text-sm font-medium text-foreground">
                      {credits !== null ? credits : '—'}
                    </span>
                  </Link>
                  {/* Animated delta badge — CSS animation (no framer-motion) */}
                  {visibleDelta && (
                    <span
                      key={visibleDelta.id}
                      className={`absolute top-full left-1/2 -translate-x-1/2 mt-1 px-2.5 py-1 rounded-full font-mono text-sm font-bold pointer-events-none whitespace-nowrap shadow-lg animate-credit-delta ${
                        visibleDelta.amount > 0
                          ? 'bg-primary/20 text-primary'
                          : 'bg-destructive/20 text-destructive'
                      }`}
                    >
                      {visibleDelta.amount > 0 ? '+' : ''}{visibleDelta.amount}
                    </span>
                  )}
                </div>

                {/* Profile dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button aria-label="Account menu" className="focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background rounded-full">
                      {user.avatar_url ? (
                        <img 
                          src={user.avatar_url} 
                          alt={user.full_name || 'User'} 
                          className="h-8 w-8 rounded-full object-cover aspect-square border border-border hover:border-foreground transition-colors"
                        />
                      ) : (
                        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors border border-border">
                          <User className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56 bg-popover border-border">
                    <div className="px-3 py-2 border-b border-border">
                      <p className="text-sm font-medium text-foreground truncate flex items-center gap-1.5">
                        {user.full_name || user.email?.split('@')[0]}
                        {user.is_verified && (
                          <BadgeCheck className="h-4 w-4 text-primary flex-shrink-0" />
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                    </div>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      onClick={() => navigate('/generations')}
                      className="cursor-pointer text-sm"
                    >
                      <Image className="h-4 w-4 mr-2" />
                      Generations
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => navigate('/credits')}
                      className="cursor-pointer text-sm"
                    >
                      <img src={creditCoinIcon} alt="" className="h-6 w-6 mr-2 object-contain" width={24} height={24} loading="eager" decoding="sync" />
                      My Credits
                    </DropdownMenuItem>
                    {isAdmin && (
                      <DropdownMenuItem
                        onClick={() => navigate('/admin/promo-codes')}
                        className="cursor-pointer text-sm"
                      >
                        <ScanEye className="h-4 w-4 mr-2" />
                        Admin
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      onClick={() => signOut()}
                      className="cursor-pointer text-sm text-destructive focus:text-destructive"
                    >
                      <LogOut className="h-4 w-4 mr-2" />
                      Sign Out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ) : (
              <Button
                variant="default"
                size="sm"
                asChild
                className="gap-2"
              >
                <Link to="/login">
                  <LogIn className="h-4 w-4" />
                  Sign In
                </Link>
              </Button>
            )}
          </nav>

          {/* Mobile Menu Button */}
          <div className="flex lg:hidden items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="relative z-10"
            >
              {isMobileMenuOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </Button>
          </div>
        </div>
      </header>

      {/* Mobile Menu Overlay - Marta Style */}
      <div 
        className={`fixed inset-0 z-40 bg-background transition-all duration-500 lg:hidden ${
          isMobileMenuOpen 
            ? 'opacity-100 pointer-events-auto' 
            : 'opacity-0 pointer-events-none'
        }`}
      >
        <nav className="flex flex-col items-center justify-center h-full gap-8">
          {/* Theme switcher - mobile only */}
          <div className={`transition-all duration-500 ${isMobileMenuOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
            style={{ transitionDelay: isMobileMenuOpen ? '100ms' : '0ms' }}>
            <ThemeSwitcher />
          </div>
          {navLinks.map((link, index) => (
            <Link 
              key={link.path}
              to={link.path}
              className={`font-display text-4xl tracking-wide transition-all duration-500 ${
                location.pathname === link.path 
                  ? 'text-foreground' 
                  : 'text-muted-foreground hover:text-foreground'
              } ${isMobileMenuOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
              style={{ transitionDelay: isMobileMenuOpen ? `${index * 100 + 200}ms` : '0ms' }}
            >
              {link.label}
            </Link>
          ))}
          
          {/* Mobile User Profile / Auth Button */}
          {user ? (
            <div 
              className={`flex flex-col items-center gap-6 transition-all duration-500 ${isMobileMenuOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
              style={{ transitionDelay: isMobileMenuOpen ? `${navLinks.length * 100 + 200}ms` : '0ms' }}
            >
              <div className="flex items-center gap-3">
                {user.avatar_url ? (
                  <img 
                    src={user.avatar_url} 
                    alt={user.full_name || 'User'} 
                    className="h-12 w-12 rounded-full object-cover aspect-square border border-border"
                  />
                ) : (
                  <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                    <User className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
                <span className="text-lg font-medium text-foreground flex items-center gap-2">
                  {user.full_name || user.email?.split('@')[0]}
                  {user.is_verified && (
                    <BadgeCheck className="h-5 w-5 text-primary flex-shrink-0" />
                  )}
                </span>
              </div>
              
              <div className="flex flex-col gap-3">
                <Link to="/generations">
                  <Button variant="outline" size="lg" className="gap-2 w-full">
                    <Image className="h-5 w-5" />
                    Generations
                  </Button>
                </Link>
                <Link to="/credits">
                  <Button variant="outline" size="lg" className="gap-2 w-full">
                    <img src={creditCoinIcon} alt="" className="h-7 w-7 object-contain" width={28} height={28} loading="eager" decoding="sync" />
                    My Credits
                  </Button>
                </Link>
                {isAdmin && (
                  <Link to="/admin/promo-codes">
                    <Button variant="outline" size="lg" className="gap-2 w-full">
                      <ScanEye className="h-5 w-5" />
                      Admin
                    </Button>
                  </Link>
                )}
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => signOut()}
                  className="gap-2"
                >
                  <LogOut className="h-5 w-5" />
                  Sign Out
                </Button>
              </div>
            </div>
          ) : (
            <Link
              to="/login"
              className={`transition-all duration-500 ${isMobileMenuOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
              style={{ transitionDelay: isMobileMenuOpen ? `${navLinks.length * 100 + 200}ms` : '0ms' }}
            >
              <Button variant="default" size="lg" className="gap-2">
                <LogIn className="h-5 w-5" />
                Sign In
              </Button>
            </Link>
          )}
        </nav>
      </div>

      {/* Spacer for fixed header */}
      <div className="h-16 lg:h-20" />
    </>
  );
}
