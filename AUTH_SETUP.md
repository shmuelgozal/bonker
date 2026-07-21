# Authentication & Authorization Setup Guide

## Overview

The system now implements role-based access control (RBAC) with two user roles:
- **Admin**: Full system access, can manage all users and frameworks
- **User**: Limited access to assigned frameworks and their children

## Initial Setup

### Step 1: Create First Admin User

Since there's no user registration UI yet, you'll need to manually create the first admin user. 

**Option A: MongoDB Connection String**

If you have MongoDB access, insert an admin user directly:

```javascript
// Connect to your MongoDB instance and run:
const bcrypt = require('bcrypt');

const passwordHash = bcrypt.hashSync('your-password-here', 10);

db.users.insertOne({
  username: 'admin',
  password_hash: passwordHash,
  email: 'admin@example.com',
  role: 'admin',
  created_at: new Date()
});
```

**Option B: Using Server Logs**

1. Start the server
2. Use the API directly to create a user (currently allows POST to `/auth/register` - this should be locked down to admin-only in the future)

### Step 2: Get JWT Token

Login with your admin credentials:

```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "your-password-here"
  }'
```

Response:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "...",
    "username": "admin",
    "email": "admin@example.com",
    "role": "admin"
  }
}
```

### Step 3: Create Additional Users

Use the returned token to create new users:

```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {your-jwt-token}" \
  -d '{
    "username": "user1",
    "password": "secure-password",
    "email": "user1@example.com",
    "role": "user"
  }'
```

### Step 4: Assign Users to Frameworks

Assign users to frameworks they should manage:

```bash
curl -X POST http://localhost:3001/api/auth/assign-framework \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {your-jwt-token}" \
  -d '{
    "userId": "user-mongo-id",
    "unitId": "framework-mongo-id"
  }'
```

## How It Works

### User Hierarchy Access

When a user is assigned to a framework (unit), they can access:
1. That framework
2. All child frameworks (if any)

**Example:**
```
Battalion A
  ├── Company 1
  └── Company 2

Bunker 1 (Battalion A)
Bunker 2 (Company 1)
Bunker 3 (Company 2)
```

If a user is assigned to "Battalion A", they can access and manage:
- All bunkers linked to Battalion A
- All bunkers linked to Company 1 and Company 2

### Admin Access

Admin users can:
- Access all frameworks and bunkers
- Create/edit/delete units
- Register new users
- Assign users to frameworks
- View all users and their permissions

### Regular User Access

Regular users can:
- View only their assigned frameworks
- View and manage bunkers in their accessible frameworks
- Cannot access admin features or settings
- Cannot manage other users

## Frontend Usage

### Login
Users see a login page at startup. Use credentials created by admin.

### User Menu
Click the username in the top right corner to see:
- Current user info
- User role (Admin/User)
- Logout button

### Conditional Features
- **Settings**: Only visible to admins
- **Unit Management**: Only admins can create/delete units, users can edit assigned frameworks
- **User Management**: Only admins have access

## API Endpoints

### Authentication (Public)
```
POST /api/auth/login
  Body: { username: string, password: string }
  Returns: { token: string, user: User }

POST /api/auth/register (admin only)
  Body: { username: string, password: string, email: string, role?: 'user' | 'admin' }
  Returns: { user: User }
```

### User Info (Protected)
```
GET /api/auth/me
  Returns: Current user info

GET /api/auth/me/units
  Returns: Array of accessible units
```

### User Management (Admin only)
```
GET /api/auth/users
  Returns: Array of all users

GET /api/auth/users/:userId
  Returns: User with assigned frameworks

POST /api/auth/assign-framework
  Body: { userId: string, unitId: string }

DELETE /api/auth/remove-framework/:userId/:unitId
```

## Security Considerations

### Current Implementation
- Passwords hashed with bcrypt
- JWT tokens signed with secret
- Token stored in localStorage
- Token sent in Authorization header
- All protected routes validate token

### Future Improvements
- [ ] JWT token refresh mechanism
- [ ] Password reset functionality
- [ ] Email verification
- [ ] IP whitelisting for admins
- [ ] Audit logging for all actions
- [ ] Two-factor authentication
- [ ] Password strength requirements
- [ ] Automatic session timeout

## Troubleshooting

### "Unauthorized" errors
- Check if Authorization header is present: `Authorization: Bearer {token}`
- Verify token hasn't expired (7 days)
- Try logging in again

### "Access denied to this framework"
- User is not assigned to this framework
- Admin must assign user via `POST /auth/assign-framework`

### "Only admins can create units"
- Only admin users can create new units
- Regular users can only manage their assigned frameworks

## Environment Variables

Add to `.env` file:

```env
JWT_SECRET=your-secret-key-change-in-production
MONGODB_URI=mongodb://...
```

Make sure to change `JWT_SECRET` in production!
