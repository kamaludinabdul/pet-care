import React, { useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, ShoppingCart, Package, BarChart3, Settings, LogOut, Users, Database, ChevronDown, ChevronRight, Receipt, Store, Printer, UserCog, Layers, Shield, Percent, Gift, Sparkles, PanelLeftClose, PanelLeftOpen, Crown, ClipboardCheck, History, TrendingUp, Clock, TrendingDown, Send, Cloud, DollarSign, Lock, PawPrint, Calendar, Home, List as ListIcon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { cn } from '../lib/utils';
import { Button } from './ui/button';
import { version } from '../../package.json';
import { checkPlanAccess, getRequiredPlanForFeature } from '../utils/plans';
import UpgradeAlert from './UpgradeAlert';

const NavItem = ({ item, isActive, onClick, className, isExpanded, isLocked }) => (
  <div
    className={cn(
      "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors w-full text-left cursor-pointer relative group",
      isActive
        ? "bg-primary/10 text-primary hover:bg-primary/20"
        : "text-muted-foreground hover:bg-muted hover:text-foreground",
      !isExpanded && "justify-center px-2",
      className
    )}
    onClick={onClick}
    title={!isExpanded ? item.label : undefined}
  >
    <div className="flex items-center gap-3 flex-1 overflow-hidden">
      {item.icon && <item.icon size={20} className="shrink-0" />}
      {isExpanded && <span className="truncate">{item.label}</span>}
    </div>

    {isLocked && (
      <div className={cn(
        "absolute right-2 top-1/2 -translate-y-1/2",
        !isExpanded && "right-0 top-0 translate-y-0 bg-amber-100 rounded-full p-0.5"
      )}>
        <Lock size={isExpanded ? 14 : 10} className="text-amber-500" />
      </div>
    )}
  </div>
);

const Sidebar = ({ isExpanded, setIsExpanded }) => {
  const { user, logout } = useAuth();
  const { currentStore } = useData();
  const navigate = useNavigate();
  const location = useLocation();
  const [isDatabaseOpen, setIsDatabaseOpen] = useState(false);
  const [isSalesOpen, setIsSalesOpen] = useState(false);
  const [isReportsOpen, setIsReportsOpen] = useState(false);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isPetCareOpen, setIsPetCareOpen] = useState(false);

  // Upgrade Alert State
  const [showUpgradeAlert, setShowUpgradeAlert] = useState(false);
  const [upgradeFeature, setUpgradeFeature] = useState('');

  const toggleSidebar = () => {
    setIsExpanded(!isExpanded);
  };

  const hasPermission = (feature) => {
    if (!user) return false;

    // Pet Care Special Check
    if (feature === 'petCare' || feature.startsWith('petCare.')) {
      // Default to true if undefined, so feature is visible by default unless explicitly disabled
      return currentStore?.petCareEnabled !== false;
    }

    if (user.role === 'super_admin') return true;

    if (!currentStore) {
      return user.role === 'admin';
    }

    const rolePermissions = currentStore.permissions?.[user.role] || [];

    if (!rolePermissions || rolePermissions.length === 0) {
      return user.role === 'admin';
    }

    if (rolePermissions.includes(feature)) return true;

    // Check if user has any sub-permission of this feature
    if (rolePermissions.some(p => p.startsWith(`${feature}.`))) return true;

    if (feature.includes('.')) {
      const parentFeature = feature.split('.')[0];
      if (rolePermissions.includes(parentFeature)) return true;
    }

    return false;
  };

  const handleItemClick = (path, requiredPlan) => {
    const currentPlan = currentStore?.plan || 'free';
    if (requiredPlan && !checkPlanAccess(currentPlan, requiredPlan)) {
      setUpgradeFeature(requiredPlan === 'enterprise' ? 'Enterprise' : 'Pro');
      setShowUpgradeAlert(true);
    } else {
      navigate(path);
    }
  };

  const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard', feature: 'dashboard' },
    { icon: Receipt, label: 'Transaksi', path: '/transactions', feature: 'pos' },
    { icon: ShoppingCart, label: 'Kasir (POS)', path: '/pos', feature: 'pos' },
  ];

  const databaseItems = [
    { icon: Package, label: 'Produk', path: '/products', feature: 'products.manage' },
    { icon: Layers, label: 'Kategori', path: '/categories', feature: 'products.categories' },
    { icon: Database, label: 'Stok', path: '/stock-management', feature: 'products.stock' },
    { icon: ClipboardCheck, label: 'Stock Opname', path: '/stock-opname', feature: 'products.stock', requiredPlan: 'pro' },
    { icon: Users, label: 'Pelanggan', path: '/customers', feature: 'products.manage', requiredPlan: 'pro' },
  ];

  const salesItems = [
    { icon: TrendingUp, label: 'Target', path: '/sales/target', feature: 'staff', requiredPlan: 'pro' },
    { icon: Cloud, label: 'Forecasting', path: '/sales/forecast', feature: 'reports', requiredPlan: 'enterprise' },
  ];

  const settingsItems = [
    { label: 'Profil Toko', path: '/settings/profile', icon: UserCog },
    { label: 'Langganan', path: '/settings/subscription', icon: Crown },
    { label: 'Biaya & Pajak', path: '/settings/fees', icon: Percent },
    { label: 'Printer & Struk', path: '/settings/printer', icon: Printer },
    { label: 'Poin Loyalitas', path: '/settings/loyalty', icon: Gift, requiredPlan: 'pro' },
    { label: 'Sales Performance', path: '/settings/sales-performance', icon: TrendingUp, requiredPlan: 'pro' },
    { label: 'Notifikasi Telegram', path: '/settings/telegram', icon: Send, requiredPlan: 'pro' },
    { label: 'Hak Akses', path: '/settings/access', icon: Shield },
  ];

  const reportsItems = [
    { path: '/reports/profit-loss', icon: BarChart3, label: 'Laba Rugi', feature: 'reports.profit_loss', requiredPlan: 'pro' },
    { path: '/reports/sales-items', icon: Package, label: 'Penjualan Barang', feature: 'reports.sales_items' },
    { path: '/reports/top-selling', icon: TrendingUp, label: 'Produk Terlaris', feature: 'reports.sales_items', requiredPlan: 'pro' },
    { path: '/reports/sales-categories', icon: Layers, label: 'Penjualan Kategori', feature: 'reports.sales_categories' },
    { path: '/reports/inventory-value', icon: TrendingUp, label: 'Nilai Stok (Modal)', feature: 'reports.inventory_value', requiredPlan: 'pro' },
    { path: '/reports/shifts', icon: Clock, label: 'Laporan Shift', feature: 'reports.shifts', requiredPlan: 'pro' },
    { path: '/reports/expenses', icon: TrendingDown, label: 'Pengeluaran', feature: 'reports.shifts' },
    { path: '/reports/loyalty-points', icon: Gift, label: 'Laporan Poin', feature: 'reports', requiredPlan: 'pro' },
    { path: '/reports/sales-performance', icon: TrendingUp, label: 'Sales Performance', feature: 'reports', checkSetting: 'enableSalesPerformance', requiredPlan: 'pro' },
  ];

  const financeItems = [
    { path: '/finance/cash-flow', icon: DollarSign, label: 'Arus Kas', feature: 'reports', requiredPlan: 'pro' },
  ];

  const bottomItems = [
    { icon: Sparkles, label: 'Rekomendasi', path: '/shopping-recommendations', feature: 'products.stock', requiredPlan: 'enterprise' },
    { icon: Users, label: 'Staff', path: '/staff', feature: 'staff' },
    { icon: History, label: 'Riwayat Login', path: '/login-history', feature: 'staff', requiredPlan: 'pro' },
  ];

  const petItems = [
    { icon: PawPrint, label: 'Hewan Peliharaan', path: '/pet-care/pets', feature: 'petCare' },
    { icon: Calendar, label: 'Reservasi', path: '/pet-care/bookings', feature: 'petCare' },
    { icon: ListIcon, label: 'Layanan & Harga', path: '/pet-care/services', feature: 'petCare' },
    { icon: Home, label: 'Kamar Hotel', path: '/pet-care/rooms', feature: 'petCare' },
  ];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const visibleDatabaseItems = databaseItems.filter(item => hasPermission(item.feature));
  const visibleSalesItems = salesItems.filter(item => hasPermission(item.feature));
  const visibleReportsItems = reportsItems.filter(item =>
    hasPermission(item.feature) && (!item.checkSetting || currentStore?.[item.checkSetting])
  );
  // Pet Care
  const visiblePetItems = petItems.filter(item => hasPermission(item.feature));

  const isDatabaseActive = visibleDatabaseItems.some(item => location.pathname.startsWith(item.path));
  const isSalesActive = visibleSalesItems.some(item => location.pathname.startsWith(item.path));
  const isReportsActive = visibleReportsItems.some(item => location.pathname.startsWith(item.path));

  const isPetCareActive = visiblePetItems.some(item => location.pathname.startsWith(item.path));
  const isSettingsActive = settingsItems.some(item => location.pathname.startsWith(item.path));

  const renderNavItem = (item) => {
    const currentPlan = currentStore?.plan || 'free';
    const isLocked = item.requiredPlan && !checkPlanAccess(currentPlan, item.requiredPlan);

    return (
      <NavItem
        key={item.path}
        item={item}
        isActive={location.pathname === item.path}
        isExpanded={isExpanded}
        isLocked={isLocked}
        onClick={() => handleItemClick(item.path, item.requiredPlan)}
      />
    );
  };

  return (
    <>
      <aside className={cn(
        "h-screen bg-white border-r flex flex-col transition-all duration-300 shrink-0",
        isExpanded ? "w-64" : "w-20"
      )}>
        <div className={cn("h-16 flex items-center px-4 border-b shrink-0", isExpanded ? "justify-between" : "justify-center")}>
          {isExpanded && (
            <div className="flex items-center gap-3 overflow-hidden">
              <img src="/logo.png" alt="KULA Logo" className="h-12 w-auto object-contain" />
            </div>
          )}
          {!isExpanded && (
            <img src="/favicon.png" alt="KULA Logo" className="h-10 w-auto object-contain" />
          )}

          {isExpanded && (
            <Button variant="ghost" size="icon" onClick={toggleSidebar} className="hidden lg:flex">
              <PanelLeftClose size={18} />
            </Button>
          )}
        </div>

        {!isExpanded && (
          <div className="flex justify-center py-2 hidden lg:flex">
            <Button variant="ghost" size="icon" onClick={toggleSidebar}>
              <PanelLeftOpen size={18} />
            </Button>
          </div>
        )}

        <nav className="flex-1 overflow-y-auto overflow-x-hidden py-4 px-3 space-y-1 scrollbar-thin">
          {user?.role === 'super_admin' && (
            <NavItem
              item={{ icon: Store, label: 'Stores', path: '/stores' }}
              isActive={location.pathname === '/stores'}
              isExpanded={isExpanded}
              onClick={() => navigate('/stores')}
            />
          )}

          {navItems.map((item) => {
            if (!hasPermission(item.feature)) return null;

            if (item.path === '/pos') {
              return (
                <a
                  key={item.path}
                  href={item.path}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors w-full text-left",
                    !isExpanded && "justify-center px-2"
                  )}
                  title={!isExpanded ? item.label : undefined}
                >
                  <item.icon size={20} className="shrink-0" />
                  {isExpanded && <span>{item.label}</span>}
                </a>
              );
            }

            return renderNavItem(item);
          })}

          {/* Pet Care Menu Group */}
          {visiblePetItems.length > 0 && (
            <div className="space-y-1">
              {isExpanded ? (
                <>
                  <button
                    className={cn(
                      "flex items-center justify-between w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                      isPetCareActive ? "text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                    onClick={() => setIsPetCareOpen(!isPetCareOpen)}
                  >
                    <div className="flex items-center gap-3">
                      <PawPrint size={20} className="shrink-0" />
                      <span>Pet Care</span>
                    </div>
                    {isPetCareOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </button>

                  {isPetCareOpen && (
                    <div className="pl-9 space-y-1 mt-1">
                      {visiblePetItems.map(renderNavItem)}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="h-px bg-slate-200 my-2 mx-2"></div>
                  {renderNavItem(visiblePetItems[0])}
                </>
              )}
            </div>
          )}

          {/* Databases Menu Group */}
          {visibleDatabaseItems.length > 0 && (
            <div className="space-y-1">
              {isExpanded ? (
                <>
                  <button
                    className={cn(
                      "flex items-center justify-between w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                      isDatabaseActive ? "text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                    onClick={() => setIsDatabaseOpen(!isDatabaseOpen)}
                  >
                    <div className="flex items-center gap-3">
                      <Database size={20} className="shrink-0" />
                      <span>Databases</span>
                    </div>
                    {isDatabaseOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </button>

                  {isDatabaseOpen && (
                    <div className="pl-9 space-y-1 mt-1">
                      {visibleDatabaseItems.map(renderNavItem)}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="h-px bg-slate-200 my-2 mx-2"></div>
                  {renderNavItem(visibleDatabaseItems[0])}
                </>
              )}
            </div>
          )}

          {/* Sales Menu Group */}
          {visibleSalesItems.length > 0 && (
            <div className="space-y-1">
              {isExpanded ? (
                <>
                  <button
                    className={cn(
                      "flex items-center justify-between w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                      isSalesActive ? "text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                    onClick={() => setIsSalesOpen(!isSalesOpen)}
                  >
                    <div className="flex items-center gap-3">
                      <TrendingUp size={20} className="shrink-0" />
                      <span>Sales</span>
                    </div>
                    {isSalesOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </button>

                  {isSalesOpen && (
                    <div className="pl-9 space-y-1 mt-1">
                      {visibleSalesItems.map(renderNavItem)}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="h-px bg-slate-200 my-2 mx-2"></div>
                  {renderNavItem(visibleSalesItems[0])}
                </>
              )}
            </div>
          )}

          {/* Reports Menu Group */}
          {visibleReportsItems.length > 0 && (
            <div className="space-y-1">
              {isExpanded ? (
                <>
                  <button
                    className={cn(
                      "flex items-center justify-between w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                      isReportsActive ? "text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                    onClick={() => setIsReportsOpen(!isReportsOpen)}
                  >
                    <div className="flex items-center gap-3">
                      <BarChart3 size={20} className="shrink-0" />
                      <span>Laporan</span>
                    </div>
                    {isReportsOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </button>

                  {isReportsOpen && (
                    <div className="pl-9 space-y-1 mt-1">
                      {visibleReportsItems.map(renderNavItem)}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="h-px bg-slate-200 my-2 mx-2"></div>
                  {renderNavItem(visibleReportsItems[0])}
                </>
              )}
            </div>
          )}

          {/* Finance Menu Group */}
          <div className="space-y-1">
            {financeItems.map((item) => {
              if (!hasPermission(item.feature)) return null;
              return renderNavItem(item);
            })}
          </div>

          {bottomItems.map((item) => {
            if (!hasPermission(item.feature)) return null;
            return renderNavItem(item);
          })}

          {/* Settings Menu Group */}
          {user?.role !== 'staff' && (
            <div className="space-y-1">
              {isExpanded ? (
                <>
                  <button
                    className={cn(
                      "flex items-center justify-between w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                      isSettingsActive ? "text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                    onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                  >
                    <div className="flex items-center gap-3">
                      <Settings size={20} className="shrink-0" />
                      <span>Pengaturan</span>
                    </div>
                    {isSettingsOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </button>

                  {isSettingsOpen && (
                    <div className="pl-9 space-y-1 mt-1">
                      {settingsItems.map(renderNavItem)}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="h-px bg-slate-200 my-2 mx-2"></div>
                  {renderNavItem(settingsItems[0])}
                </>
              )}
            </div>
          )}
        </nav>

        <div className="p-4 border-t shrink-0 bg-white space-y-2">
          <button
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 w-full transition-colors",
              !isExpanded && "justify-center px-2"
            )}
            onClick={handleLogout}
            title={!isExpanded ? "Keluar" : undefined}
          >
            <LogOut size={20} className="shrink-0" />
            {isExpanded && <span>Keluar</span>}
          </button>

          <div className={cn(
            "text-xs text-slate-400 text-center pt-2",
            !isExpanded && "text-[10px]"
          )}>
            <NavLink to="/changelog" className="hover:text-indigo-600 hover:underline transition-colors block p-1">
              v{version}
            </NavLink>
          </div>
        </div>
      </aside>

      <UpgradeAlert
        isOpen={showUpgradeAlert}
        onClose={() => setShowUpgradeAlert(false)}
        title={`Fitur ${upgradeFeature}`}
        description={`Fitur ini hanya tersedia untuk paket ${upgradeFeature} dan di atasnya. Upgrade sekarang untuk membuka akses!`}
        benefits={[
          "Akses ke semua laporan detail",
          "Manajemen stok lanjutan",
          "Multi-user staff",
          "Dan banyak lagi..."
        ]}
      />
    </>
  );
};

export default Sidebar;
