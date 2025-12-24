# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2025-12-10

### Added
- **Medical Records**:
  - Full **Table Layout** implementation with fixed column widths.
  - **Sorting**: Sort by Date, RM Number, or Pet Name.
  - **Pagination**: Client-side pagination (10 items/page).
  - **Date Range Filter**: Filter records by custom date ranges.
  - **Smart Next Visit**: Automatically hides "Next Visit" for completed cycles.
  - **Print**: PDF Export for Medical Record Details.
  - **RM Number**: Displayed in list and details.
- **Data Attributes**:
  - `rmNumber` (No. Rekam Medis) added to Pets.
  - `storeId` enforcement for multi-tenancy.

### Fixed
- **Missing Pets**: Restoration of pets (e.g., "Lulu", "Mochi") missing `storeId`.
- **Owner Display**: Fixed "Tanpa Pemilik" issue by implementing dynamic Customer lookup.
- **Performance**: Optimized list rendering with pagination.
- **UI/UX**: Refined DatePicker styling and Table density.

### Changed
- **Medical Records List**: Moved from Card view to Table view for better density.
- **Detail View**: Refined modal layout with printer-friendly styling.
