
export const AVAILABLE_PERMISSIONS = [
    {
        id: 'pos',
        label: 'Akses POS (Kasir)',
        description: 'Bisa melakukan transaksi, buka/tutup shift.',
        defaultFor: ['admin', 'staff', 'sales']
    },
    {
        id: 'pet_care_access', // Special flag handled separately in UI but good to list
        label: 'Akses Pet Care',
        description: 'Bisa login ke aplikasi Pet Care.',
        defaultFor: ['dokter', 'paramedis']
    },
    {
        category: 'Produk & Stok',
        items: [
            { id: 'products.manage', label: 'Kelola Produk', description: 'Tambah, edit, hapus produk.' },
            { id: 'products.stock', label: 'Kelola Stok', description: 'Input stok masuk, opname.' },
            { id: 'products.categories', label: 'Kelola Kategori', description: 'Atur kategori produk.' }
        ]
    },
    {
        category: 'Laporan',
        items: [
            { id: 'reports.view', label: 'Lihat Laporan Dasar', description: 'Akses menu laporan.' },
            { id: 'reports.profit_loss', label: 'Laporan Laba Rugi', description: 'Lihat profit & loss.' },
            { id: 'reports.financial', label: 'Laporan Keuangan', description: 'Semua laporan keuangan sensitif.' }
        ]
    },
    {
        category: 'Administrasi',
        items: [
            { id: 'manage_staff', label: 'Kelola Staff', description: 'Tambah/Edit/Hapus user.' },
            { id: 'manage_settings', label: 'Pengaturan Toko', description: 'Ubah info toko, printer, dll.' },
            { id: 'delete_records', label: 'Hapus Data Penting', description: 'Hapus transaksi/data master.' }
        ]
    }
];


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
