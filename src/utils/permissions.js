// Helper function to normalize and ensure complete permissions
export const normalizePermissions = (permissions) => {
    if (!permissions) {
        return {
            admin: [
                'dashboard',
                'pos',
                'settings',
                'staff',
                'products',
                'products.manage',
                'products.categories',
                'products.stock',
                'reports',
                'reports.profit_loss',
                'reports.sales_items',
                'reports.sales_categories',
                'reports.inventory_value',
                'reports.shifts'
            ],
            staff: ['pos'],
            sales: ['pos']
        };
    }

    const normalized = { ...permissions };

    // Normalize admin permissions
    if (normalized.admin) {
        const adminSet = new Set(normalized.admin);

        // If has 'products' parent, ensure all sub-permissions
        if (adminSet.has('products')) {
            adminSet.add('products.manage');
            adminSet.add('products.categories');
            adminSet.add('products.stock');
        }

        // If has 'reports' parent, ensure all sub-permissions
        if (adminSet.has('reports')) {
            adminSet.add('reports.profit_loss');
            adminSet.add('reports.sales_items');
            adminSet.add('reports.sales_categories');
            adminSet.add('reports.inventory_value');
            adminSet.add('reports.shifts');
        }

        normalized.admin = Array.from(adminSet);
    }

    // Normalize staff permissions
    if (normalized.staff) {
        const staffSet = new Set(normalized.staff);

        if (staffSet.has('products')) {
            staffSet.add('products.manage');
            staffSet.add('products.categories');
            staffSet.add('products.stock');
        }

        if (staffSet.has('reports')) {
            staffSet.add('reports.profit_loss');
            staffSet.add('reports.sales_items');
            staffSet.add('reports.sales_categories');
            staffSet.add('reports.inventory_value');
            staffSet.add('reports.shifts');
        }

        normalized.staff = Array.from(staffSet);
    }

    // Normalize sales permissions
    if (normalized.sales) {
        const salesSet = new Set(normalized.sales);

        if (salesSet.has('products')) {
            salesSet.add('products.manage');
            salesSet.add('products.categories');
            salesSet.add('products.stock');
        }

        if (salesSet.has('reports')) {
            salesSet.add('reports.profit_loss');
            salesSet.add('reports.sales_items');
            salesSet.add('reports.sales_categories');
            salesSet.add('reports.inventory_value');
            salesSet.add('reports.shifts');
        }

        normalized.sales = Array.from(salesSet);
    }

    return normalized;
};
