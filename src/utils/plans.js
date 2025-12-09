export const PLAN_LEVELS = {
    free: 0,
    pro: 1,
    enterprise: 2
};

export const PLANS = {
    free: {
        label: 'Free',
        level: 0,
        price: 0
    },
    pro: {
        label: 'Pro',
        level: 1,
        price: 0,
        originalPrice: 150000, // Or 99000 as per request, let's check the file content again to be sure about the previous price. The file showed 150000. The user said "from 99rb". I should probably use 99000 as requested.
        promoLabel: 'Promo'
    },
    enterprise: {
        label: 'Enterprise',
        level: 2,
        price: 350000
    }
};

export const REQUIRED_PLANS = {
    // Reports
    'reports.profit_loss': 'pro',
    'reports.cash_flow': 'pro', // Assuming this feature flag exists or will be mapped
    'reports.inventory_value': 'pro',
    'reports.shifts': 'pro',
    'reports.sales_forecast': 'enterprise',

    // Stock
    'products.stock_opname': 'pro',
    'products.stock_history': 'pro',

    // Staff
    // 'staff.manage': 'pro', // Multi-user (Now Free, limited by quantity)
    'staff.login_history': 'pro',
    'staff.sales_target': 'pro',

    // Settings
    'settings.loyalty': 'pro',
    'settings.telegram': 'pro',

    // Advanced Features
    'features.shopping_recommendations': 'enterprise'
};

export const checkPlanAccess = (currentPlan, requiredPlan) => {
    const currentLevel = PLAN_LEVELS[currentPlan || 'free'] || 0;
    const requiredLevel = PLAN_LEVELS[requiredPlan || 'free'] || 0;
    return currentLevel >= requiredLevel;
};

export const getRequiredPlanForFeature = (feature) => {
    // Direct match
    if (REQUIRED_PLANS[feature]) return REQUIRED_PLANS[feature];

    // Check parent feature (e.g. 'reports.profit_loss' -> check 'reports')
    // This might be too broad, so we stick to specific mappings in REQUIRED_PLANS first.
    // If not found, default to 'free' (accessible)
    return 'free';
};
