import React, { useState, useRef, useEffect } from 'react';
import { Bell, Search, User, LogOut, Settings, ChevronDown, Package, AlertTriangle } from 'lucide-react';
import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';

interface Notification {
  id: string;
  title: string;
  description: string;
  type: 'warning' | 'info';
  time: string;
}

export function Header() {
  const { data: session } = useSession();
  const [showMenu, setShowMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const menuRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  // Close menus when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch low stock alerts
  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        const meRes = await fetch('/api/me');
        if (!meRes.ok) return;
        const meData = await meRes.json();
        const businessId = meData.businessId;
        if (!businessId) return;

        const statsRes = await fetch('/api/stats', {
          headers: { 'x-business-id': businessId },
        });
        if (!statsRes.ok) return;
        const stats = await statsRes.json();

        const lowStockNotifs: Notification[] = (stats.lowStockProducts || []).map((p: any) => ({
          id: p.id,
          title: `Stock bajo: ${p.name}`,
          description: `Solo quedan ${p.stock} unidades`,
          type: 'warning' as const,
          time: 'Ahora',
        }));

        setNotifications(lowStockNotifs);
      } catch (e) {
        // Silently fail
      }
    };
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 60000); // Refresh every 60s
    return () => clearInterval(interval);
  }, []);

  const userName  = session?.user?.name  || 'Usuario';
  const userEmail = session?.user?.email || '';
  const initials  = userName.charAt(0).toUpperCase();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border/50 bg-background/80 px-6 backdrop-blur-xl">
      {/* Search */}
      <div className="relative max-w-md flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Buscar productos, clientes, ventas..."
          className="h-10 w-full rounded-lg border border-input bg-background/50 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-ring hover:border-primary/30"
        />
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3">
        {/* Notifications */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative flex h-10 w-10 items-center justify-center rounded-lg transition-colors hover:bg-accent"
          >
            <Bell className="h-5 w-5 text-muted-foreground" />
            {notifications.length > 0 && (
              <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                {notifications.length > 9 ? '9+' : notifications.length}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 top-full mt-2 w-80 animate-slide-up rounded-xl border border-border/50 bg-card shadow-2xl overflow-hidden">
              <div className="border-b border-border/50 px-4 py-3 flex items-center justify-between">
                <p className="text-sm font-bold">Notificaciones</p>
                <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-semibold text-red-500">
                  {notifications.length}
                </span>
              </div>
              <div className="max-h-72 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                    <Bell className="mb-2 h-8 w-8 opacity-30" />
                    <p className="text-sm">Sin notificaciones</p>
                  </div>
                ) : (
                  <ul>
                    {notifications.map((n) => (
                      <li
                        key={n.id}
                        className="flex items-start gap-3 border-b border-border/30 px-4 py-3 transition-colors hover:bg-muted/30 last:border-0"
                      >
                        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500">
                          <AlertTriangle className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{n.title}</p>
                          <p className="text-xs text-muted-foreground">{n.description}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {notifications.length > 0 && (
                <Link
                  href="/dashboard/products"
                  onClick={() => setShowNotifications(false)}
                  className="block border-t border-border/50 px-4 py-2.5 text-center text-xs font-medium text-primary hover:bg-accent transition-colors"
                >
                  Ver Inventario →
                </Link>
              )}
            </div>
          )}
        </div>

        {/* User menu */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-accent"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full gradient-primary text-sm font-bold text-white">
              {initials}
            </div>
            <div className="hidden text-left md:block">
              <p className="text-sm font-medium leading-none">{userName}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{userEmail}</p>
            </div>
            <ChevronDown className={`hidden h-4 w-4 text-muted-foreground transition-transform duration-200 md:block ${showMenu ? 'rotate-180' : ''}`} />
          </button>

          {/* Dropdown */}
          {showMenu && (
            <div className="absolute right-0 top-full mt-2 w-52 animate-slide-up rounded-xl border border-border/50 bg-card shadow-2xl overflow-hidden">
              <div className="border-b border-border/50 px-4 py-3">
                <p className="text-sm font-semibold">{userName}</p>
                <p className="text-xs text-muted-foreground truncate">{userEmail}</p>
              </div>
              <div className="p-1">
                <Link
                  href="/dashboard/settings"
                  onClick={() => setShowMenu(false)}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-accent"
                >
                  <Settings className="h-4 w-4 text-muted-foreground" />
                  Configuración
                </Link>
                <button
                  onClick={() => signOut({ callbackUrl: '/auth/login' })}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-red-400 transition-colors hover:bg-red-500/10"
                >
                  <LogOut className="h-4 w-4" />
                  Cerrar sesión
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
