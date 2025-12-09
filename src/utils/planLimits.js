export const PLAN_LIMITS = {
    free: {
        maxUsers: 2, // 1 Admin + 1 Cashier
        allowedRoles: ['admin', 'cashier'],
        maxProducts: 100,
        features: ['pos', 'reports.basic']
    },
    pro: {
        maxUsers: 5,
        allowedRoles: ['admin', 'cashier', 'sales'],
        maxProducts: Infinity,
        features: ['pos', 'reports.advanced', 'stock']
    },
    enterprise: {
        maxUsers: Infinity,
        allowedRoles: ['admin', 'cashier', 'sales', 'super_admin'],
        maxProducts: Infinity,
        features: ['all']
    }
};

export const checkPlanLimit = (plan, type, value) => {
    const limits = PLAN_LIMITS[plan || 'free'] || PLAN_LIMITS.free;

    if (type === 'users') {
        if (limits.maxUsers === Infinity) return { allowed: true };
        return {
            allowed: value < limits.maxUsers,
            limit: limits.maxUsers,
            current: value
        };
    }

    if (type === 'roles') {
        // value here is the role string being checked
        if (!limits.allowedRoles) return { allowed: true }; // Default allow if not specified
        return {
            allowed: limits.allowedRoles.includes(value),
            allowedRoles: limits.allowedRoles
        };
    }

    if (type === 'products') {
        if (limits.maxProducts === Infinity) return { allowed: true };
        return {
            allowed: value < limits.maxProducts,
            limit: limits.maxProducts,
            current: value
        };
    }

    return { allowed: true };
};
