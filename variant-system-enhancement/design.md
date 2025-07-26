# Design Document

## Overview

The variant system enhancement will fix critical data model alignment issues and improve the clothing-specific variant management for Mario Uomo. The design focuses on ensuring proper persistence of variant option values, robust stock management, and performance optimization while maintaining backward compatibility with existing data.

## Architecture

### Data Model Architecture

The variant system uses a **parent-child relationship** within the `tabItem` table:

```
Master Product (Parent)
├── id: UUID (primary key)
├── parent: NULL (indicates master product)
├── has_variants: true
├── option1_name: "Size"
├── option2_name: "Color"
└── clothing attributes (fit_type, material, etc.)

Variant Products (Children)
├── id: UUID (primary key)  
├── parent: UUID (references master product)
├── option1_value: "Large" (size value)
├── option2_value: "Blue" (color value)
├── item_code: unique SKU
└── inherited clothing attributes
```

### Database Schema Enhancements

**Critical Fix - Sequelize Model Alignment:**
```typescript
// Current Issue: option value fields missing from Sequelize model
// Solution: Add missing fields to Item model

option1_value: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'First option value (e.g., size: "M", "L", "XL")'
},
option2_value: {
    type: DataTypes.STRING, 
    allowNull: true,
    comment: 'Second option value (e.g., color: "Blue", "Red")'
},
option3_value: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Third option value (future expansion)'
}
```

**Performance Indexes:**
```sql
-- Optimize variant loading queries
CREATE INDEX idx_variants_performance ON tabItem (parent, createdAt);

-- Optimize option value filtering
CREATE INDEX idx_variant_options ON tabItem (option1_value, option2_value, parent);
```

## Components and Interfaces

### 1. Enhanced Item Model (`db/models/item.model.ts`)

**Responsibilities:**
- Define complete variant field structure
- Maintain parent-child associations
- Support clothing-specific attributes

**Key Methods:**
```typescript
// Self-referential associations for variants
ItemGroup.hasMany(ItemGroup, { 
    as: 'variants', 
    foreignKey: 'parent'
});

ItemGroup.belongsTo(ItemGroup, { 
    as: 'masterProduct', 
    foreignKey: 'parent'
});
```

### 2. Variant Service (`services/item/VariantService.ts`)

**Responsibilities:**
- Centralized variant operations
- Stock management integration
- Performance monitoring

**Key Methods:**
```typescript
class VariantService {
    static async createVariants(masterItem, variantData, user): Promise<any[]>
    static async updateExistingVariants(variantsToUpdate, user): Promise<void>
    static async deleteVariants(variantsToDelete, user): Promise<void>
    static async updateVariantStock(itemCode, newStockQuantity, user): Promise<void>
    static classifyVariants(variantData, existingVariants): VariantClassification
}
```

### 3. Enhanced Item Controller (`controllers/item.controller.ts`)

**Responsibilities:**
- API endpoint handling
- Variant data processing
- Error handling and logging

**Critical Fix - Variant Creation:**
```typescript
// Current Issue: option values not assigned during creation
// Solution: Proper option value assignment

await Item.create({
    // ... other fields
    option1_name: 'Size',
    option1_value: variant.size,
    option2_name: 'Color', 
    option2_value: variant.color,
    parent: masterItem.id
});
```

### 4. Performance Monitoring (`utils/performance-monitoring.js`)

**Responsibilities:**
- Real-time operation tracking
- Slow query detection
- Performance metrics collection

**Key Features:**
```typescript
class VariantPerformanceMonitor {
    async monitorVariantOperation(operationName, operation, context)
    async monitorStockOperation(operationName, operation, context)
    getPerformanceSummary(): PerformanceSummary
}
```

## Data Models

### Variant Data Structure

**Frontend Variant Object:**
```typescript
interface VariantData {
    id?: string;                    // UUID or temp ID for new variants
    size: string;                   // Maps to option1_value
    color: string;                  // Maps to option2_value
    selling_price: number;
    stock_quantity?: number;
    sku?: string;                   // Generated item_code
}
```

**Backend Database Record:**
```typescript
interface ItemRecord {
    id: string;                     // UUID primary key
    parent: string | null;          // Master product ID for variants
    item_code: string;              // Unique SKU
    option1_name: string;           // "Size"
    option1_value: string;          // "Large"
    option2_name: string;           // "Color"  
    option2_value: string;          // "Blue"
    selling_price: number;
    // ... clothing attributes
    clothing_category: string;
    fit_type: string;
    primary_material: string;
}
```

### Stock Management Data Model

**Stock Ledger Entry Structure:**
```typescript
interface StockLedgerEntry {
    id: string;
    item_code: string;              // Links to variant
    warehouse: string;              // Warehouse ID
    stock_value: number;            // Quantity change
    stock_value_back_room: number;  // Back room stock
    qty_after_transaction: number;  // Running total
    voucher_type: string;           // "Stock Entry" | "Stock Reconciliation"
    posting_date: Date;
}
```

## Error Handling

### Graceful Degradation Strategy

**Stock Operation Failures:**
```typescript
try {
    await VariantService.updateVariantStock(itemCode, quantity, user);
} catch (stockError) {
    console.error(`Stock update failed for ${itemCode}:`, stockError);
    // Continue with other operations - don't fail entire product update
}
```

**Variant Processing Errors:**
```typescript
// Process variants individually to isolate failures
for (const variant of variantsToUpdate) {
    try {
        await processVariant(variant);
    } catch (variantError) {
        console.error(`Variant ${variant.id} update failed:`, variantError);
        // Log error but continue with remaining variants
    }
}
```

### Data Validation

**Variant Data Validation:**
```typescript
const validateVariant = (variant: VariantData): ValidationResult => {
    const errors = [];
    
    if (!variant.size && !variant.color) {
        errors.push('Variant must have at least size or color');
    }
    
    if (variant.selling_price && variant.selling_price < 0) {
        errors.push('Selling price cannot be negative');
    }
    
    return { isValid: errors.length === 0, errors };
};
```

## Testing Strategy

### Unit Testing Approach

**Model Testing:**
```typescript
describe('Item Model Variant Fields', () => {
    test('should save option values correctly', async () => {
        const variant = await Item.create({
            option1_value: 'Large',
            option2_value: 'Blue',
            parent: masterProductId
        });
        
        expect(variant.option1_value).toBe('Large');
        expect(variant.option2_value).toBe('Blue');
    });
});
```

**Service Testing:**
```typescript
describe('VariantService', () => {
    test('should create variants with proper option values', async () => {
        const variants = await VariantService.createVariants(
            masterProduct,
            [{ size: 'M', color: 'Red' }],
            user
        );
        
        expect(variants[0].option1_value).toBe('M');
        expect(variants[0].option2_value).toBe('Red');
    });
});
```

### Integration Testing

**API Endpoint Testing:**
```typescript
describe('Variant API Integration', () => {
    test('should create product with variants via API', async () => {
        const response = await request(app)
            .post('/api/items')
            .send({
                item_name: 'Test Shirt',
                variants: JSON.stringify([
                    { size: 'L', color: 'Blue', stock_quantity: 10 }
                ])
            });
            
        expect(response.status).toBe(200);
        expect(response.body.createdVariants).toHaveLength(1);
    });
});
```

### Performance Testing

**Query Performance Validation:**
```typescript
describe('Variant Performance', () => {
    test('should load variants in under 50ms', async () => {
        const startTime = performance.now();
        const variants = await Item.findAll({ 
            where: { parent: testProductId } 
        });
        const duration = performance.now() - startTime;
        
        expect(duration).toBeLessThan(50);
        expect(variants.length).toBeGreaterThan(0);
    });
});
```

## Frontend Architecture

### Dashboard (Vue.js) Components

**1. Enhanced Product Creation/Edit Form (`dashboard/src/pages/products/create.vue`)**
- Variant management section with dynamic size/color grid
- Bulk variant creation with size/color combinations
- Individual variant pricing and stock management
- Drag-and-drop image assignment per variant
- Real-time stock validation and warnings

**2. Variant Management Component (`dashboard/src/components/product/VariantManager.vue`)**
```vue
<template>
  <div class="variant-manager">
    <!-- Variant Creation Grid -->
    <div class="variant-grid">
      <div class="size-color-matrix">
        <!-- Size/Color combination selector -->
      </div>
    </div>
    
    <!-- Individual Variant Cards -->
    <div class="variant-cards">
      <VariantCard 
        v-for="variant in variants" 
        :key="variant.id"
        :variant="variant"
        @update="updateVariant"
        @delete="deleteVariant"
      />
    </div>
  </div>
</template>
```

**3. Variant Analytics Dashboard (`dashboard/src/components/product/VariantAnalytics.vue`)**
- Variant-level sales performance charts
- Stock level indicators by size/color
- Reorder recommendations based on sales velocity
- Export functionality for variant data

### E-commerce (Next.js) Components

**1. Product Detail Page Enhancement (`ecom/frontend/src/app/products/[id]/page.tsx`)**
```typescript
interface ProductWithVariants {
  id: string;
  item_name: string;
  variants: ProductVariant[];
  master_images: string[];
  variant_images: { [variantId: string]: string[] };
}

interface ProductVariant {
  id: string;
  option1_value: string; // size
  option2_value: string; // color
  selling_price: number;
  stock_quantity: number;
  item_code: string;
}
```

**2. Variant Selector Component (`ecom/frontend/src/components/product/VariantSelector.tsx`)**
```typescript
const VariantSelector = ({ 
  variants, 
  selectedVariant, 
  onVariantChange 
}) => {
  // Size selector buttons
  // Color selector swatches
  // Stock availability indicators
  // Price updates based on selection
}
```

**3. Enhanced Product Listing (`ecom/frontend/src/app/products/page.tsx`)**
- Variant-aware filtering (size, color, availability)
- Search functionality including variant attributes
- Quick variant preview on hover
- Stock status indicators

**4. Shopping Cart Integration (`ecom/frontend/src/components/cart/CartItem.tsx`)**
```typescript
interface CartItem {
  productId: string;
  variantId: string;
  size: string;
  color: string;
  quantity: number;
  price: number;
  image: string;
}
```

## API Enhancements

### Backend API Extensions

**1. Enhanced Product Endpoints**
```typescript
// GET /api/public/products/:id - Include variants
{
  product: ProductData,
  variants: VariantData[],
  stock_levels: { [variantId: string]: number }
}

// GET /api/public/products - Variant-aware filtering
?size=M,L&color=Blue,Black&in_stock=true

// POST /api/items - Enhanced variant creation
{
  product: ProductData,
  variants: [
    { size: 'M', color: 'Blue', stock_quantity: 10, selling_price: 99.99 }
  ]
}
```

**2. Variant-Specific Endpoints**
```typescript
// GET /api/variants/:productId - Get all variants for a product
// PUT /api/variants/:variantId/stock - Update variant stock
// GET /api/variants/search - Search variants by attributes
```

### Frontend API Integration

**1. Dashboard API Service (`dashboard/src/utils/variant-api.js`)**
```javascript
export const variantApi = {
  createVariants: (productId, variants) => {},
  updateVariant: (variantId, data) => {},
  getVariantStock: (variantId) => {},
  updateVariantStock: (variantId, quantity) => {},
  getVariantAnalytics: (productId, dateRange) => {}
}
```

**2. E-commerce API Service (`ecom/frontend/src/lib/variant-api.ts`)**
```typescript
export const variantApi = {
  getProductWithVariants: (productId: string) => Promise<ProductWithVariants>,
  searchProductsByVariants: (filters: VariantFilters) => Promise<Product[]>,
  checkVariantStock: (variantId: string) => Promise<number>,
  getVariantsByAttributes: (size?: string, color?: string) => Promise<Variant[]>
}
```

## Implementation Phases

### Phase 1: Critical Backend Model Fix
1. Add missing option value fields to Sequelize Item model
2. Fix variant creation in item controller
3. Verify database field compatibility

### Phase 2: Stock Management Enhancement  
1. Implement robust stock adjustment logic
2. Add default warehouse creation
3. Enhance error handling for stock operations

### Phase 3: Performance Optimization
1. Add database indexes for variant queries
2. Implement performance monitoring system
3. Optimize slow variant operations

### Phase 4: Data Migration
1. Populate missing option values for existing variants
2. Validate data integrity after migration
3. Update variant metadata (names, brands, categories)

### Phase 5: Dashboard Frontend Integration
1. Create VariantManager component for product creation/editing
2. Implement variant analytics dashboard
3. Add bulk variant operations and image management
4. Integrate real-time stock validation

### Phase 6: E-commerce Frontend Integration
1. Enhance product detail pages with variant selection
2. Implement variant-aware product filtering and search
3. Update shopping cart to handle variant information
4. Add variant-specific product recommendations

### Phase 7: API Enhancement and Integration
1. Extend backend APIs to support variant operations
2. Implement frontend API services for both dashboard and e-comm
3. Add real-time stock checking and updates
4. Integrate variant analytics and reporting

This comprehensive design ensures the variant system will be robust, performant, and maintainable while providing excellent user experiences across both admin dashboard and customer-facing e-commerce platforms.