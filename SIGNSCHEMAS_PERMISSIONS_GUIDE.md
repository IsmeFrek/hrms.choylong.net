# SignSchemas Permission Implementation Summary

## Overview
Added comprehensive role-based permission management for SignSchemas (Signatures), allowing administrators to control who can view, create, edit, and delete signatures across different roles.

## Changes Made

### 1. Backend - Permissions Configuration
**File: `backend/permissions.js`**
- Added four new permission types for SignSchemas:
  - `view:signSchemas` - View/list signatures
  - `create:signSchemas` - Create new signatures  
  - `edit:signSchemas` - Edit existing signatures
  - `delete:signSchemas` - Delete signatures

### 2. Backend - Authentication Middleware
**File: `backend/middleware/auth.js`**
- Already includes `requirePermission()` middleware function
- Automatically aggregates permissions from user roles
- Validates each route request against required permissions

### 3. Backend - Signature Routes
**File: `backend/routes/signatures.js`**
- Added permission checks to all routes:
  - `GET /api/signatures` → requires `view:signSchemas`
  - `POST /api/signatures` → requires `create:signSchemas`
  - `PUT /api/signatures/:id` → requires `edit:signSchemas`
  - `DELETE /api/signatures/:id` → requires `delete:signSchemas`
  - `POST /api/signatures/bulk-import` → requires `create:signSchemas`
- All unauthorized requests return 403 Forbidden with descriptive message

### 4. Frontend - Role Management Page
**File: `src/pages/RolesPage.jsx`**
- Added `groupPermissions()` function to organize permissions by category:
  - User & Role Management
  - Employees & HR
  - Departments & Units
  - Files & Documents
  - **SignSchemas (Signatures)** ← NEW CATEGORY
  - Reports
  - Other
- Updated UI to display grouped permissions with better visual organization
- Administrators can toggle individual permissions per role using checkboxes
- Display text now includes Khmer: "អាចកែ លុប មើ់ល" (Can edit, delete, view)

### 5. Frontend - SignSchemas Management Page (NEW)
**File: `src/pages/SignSchemasPage.jsx`**
- New dedicated page for managing signatures with full CRUD operations
- Permission-based UI:
  - Only shows page if user has `view:signSchemas` permission
  - Create form only displayed if user has `create:signSchemas` permission
  - Delete buttons only shown if user has `delete:signSchemas` permission
- Features:
  - List all signatures with details (name, type, position, department, status)
  - Create new signatures with file upload
  - Delete signatures
  - Real-time permission indicators showing user's access levels
  - Form fields: name, full name (Khmer), type, position, department, description, notes
  - Error/success messaging

## Permission Model

Each role can have any combination of these permissions:
```
Role: Editor
├── view:signSchemas
├── create:signSchemas
└── edit:signSchemas

Role: Viewer
└── view:signSchemas

Role: Admin
├── view:signSchemas
├── create:signSchemas
├── edit:signSchemas
└── delete:signSchemas
```

## Usage

### For Administrators
1. Go to Role Management page
2. Select a role from the list
3. Scroll to "SignSchemas (Signatures)" section
4. Toggle desired permissions:
   - ✓ view:signSchemas
   - ✓ create:signSchemas
   - ✓ edit:signSchemas
   - ✓ delete:signSchemas
5. Click Save

### For Users
1. Access SignSchemas Management page (if permitted)
2. View section displays all signatures
3. Create form available if you have create permission
4. Delete buttons appear if you have delete permission
5. Permission summary shown at bottom of page

## Security

- All API endpoints validate permissions on server-side
- Frontend checks are UI helpers only; server-side validation is authoritative
- Unauthorized requests receive 403 Forbidden response
- Permission checks are logged for audit purposes
- Permissions are aggregated from all user roles

## Files Modified/Created

### Modified
- ✏️ `backend/permissions.js` - Added SignSchema permissions
- ✏️ `backend/routes/signatures.js` - Added permission middleware to all routes
- ✏️ `src/pages/RolesPage.jsx` - Added permission grouping and Khmer text

### Created
- ✨ `src/pages/SignSchemasPage.jsx` - New management page with full CRUD

## Testing

Test permission enforcement:
1. Create a test role with only `view:signSchemas`
2. Assign to test user
3. Verify user can view but cannot create/edit/delete
4. Check console for "Permission denied" logs
5. Verify API returns 403 on unauthorized operations
