import express, { Response } from 'express';
import bcrypt from 'bcrypt';
import { User, UserFrameworkPermission, Unit, AccessRequest, Bunker } from '../db/mongo';
import { generateToken, authMiddleware, AuthenticatedRequest, adminOnly } from '../middleware/auth';

const router = express.Router();

// Request access (no auth required - for first-time users)
router.post('/request-access', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    if (username.length < 3) {
      return res.status(400).json({ error: 'Username must be at least 3 characters' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Check if username already exists (user or pending request)
    const existingUser = await User.findOne({ username });
    const existingRequest = await AccessRequest.findOne({ username });

    if (existingUser) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    if (existingRequest && existingRequest.status === 'pending') {
      return res.status(400).json({ error: 'Access request already pending' });
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, 10);

    // Create access request
    const request = new AccessRequest({
      username,
      password_hash,
      status: 'pending',
    });

    await request.save();

    return res.status(201).json({
      message: 'Access request submitted. Please wait for admin approval.',
      requestId: request._id,
    });
  } catch (error) {
    console.error('Access request error:', error);
    return res.status(500).json({ error: 'Failed to submit access request' });
  }
});

// Register (admin only)
router.post('/register', authMiddleware, adminOnly, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { username, password, role = 'user' } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, 10);

    // Create user
    const user = new User({
      username,
      password_hash,
      role: role === 'admin' ? 'admin' : 'user',
    });

    await user.save();

    return res.status(201).json({
      id: user._id,
      username: user.username,
      role: user.role,
    });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({ error: 'Registration failed' });
  }
});

// Login
router.post('/login', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    // Find user
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check password
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate token
    const token = generateToken(user._id.toString(), user.username, user.role);

    return res.json({
      token,
      user: {
        id: user._id,
        username: user.username,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Login failed' });
  }
});

// Get current user info
router.get('/me', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = await User.findById(req.user.id).select('-password_hash');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json(user);
  } catch (error) {
    console.error('Get user error:', error);
    return res.status(500).json({ error: 'Failed to get user info' });
  }
});

// Get user's accessible units
router.get('/me/units', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Admin can see all units
    if (user.role === 'admin') {
      const units = await Unit.find({});
      return res.json(units);
    }

    // User can see their assigned units and children
    const permissions = await UserFrameworkPermission.find({ user_id: req.user.id }).populate('unit_id');
    const unitIds: string[] = [];

    for (const permission of permissions) {
      unitIds.push((permission.unit_id as any)._id.toString());

      // Add all child units
      async function addChildren(parentId: any) {
        const children = await Unit.find({ parent_unit_id: parentId });
        for (const child of children) {
          unitIds.push(child._id.toString());
          await addChildren(child._id);
        }
      }

      await addChildren((permission.unit_id as any)._id);
    }

    const units = await Unit.find({ _id: { $in: unitIds } });
    return res.json(units);
  } catch (error) {
    console.error('Get user units error:', error);
    return res.status(500).json({ error: 'Failed to get units' });
  }
});

// Get user's assigned frameworks with summaries (non-admin endpoint)
router.get('/me/frameworks-summary', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get user's assigned frameworks (only top-level: battalion and company)
    const permissions = await UserFrameworkPermission.find({ user_id: req.user.id }).populate('unit_id');
    
    const frameworks: Array<{
      id: string;
      name: string;
      type: string;
      bunker_count: number;
    }> = [];

    for (const permission of permissions) {
      const unit = permission.unit_id as any;
      if (!unit || !unit._id) continue;

      // Get all child units (for bunker counting)
      const unitIds: string[] = [unit._id.toString()];
      
      async function addChildren(parentId: any) {
        const children = await Unit.find({ parent_unit_id: parentId });
        for (const child of children) {
          unitIds.push(child._id.toString());
          await addChildren(child._id);
        }
      }
      
      await addChildren(unit._id);

      // Count bunkers for this framework tree
      const bunkerCount = await Bunker.countDocuments({
        unit_id: { $in: unitIds }
      });

      frameworks.push({
        id: unit._id.toString(),
        name: unit.name,
        type: unit.type,
        bunker_count: bunkerCount || 0,
      });
    }

    return res.json(frameworks);
  } catch (error) {
    console.error('Get frameworks summary error:', error);
    return res.status(500).json({ error: 'Failed to get frameworks summary' });
  }
});

// Assign user to framework (admin only)
router.post('/assign-framework', authMiddleware, adminOnly, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId, unitId } = req.body;

    if (!userId || !unitId) {
      return res.status(400).json({ error: 'userId and unitId are required' });
    }

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if unit exists
    const unit = await Unit.findById(unitId);
    if (!unit) {
      return res.status(404).json({ error: 'Unit not found' });
    }

    // Check if permission already exists
    const existingPermission = await UserFrameworkPermission.findOne({ user_id: userId, unit_id: unitId });
    if (existingPermission) {
      return res.status(400).json({ error: 'User already has access to this framework' });
    }

    // Create permission
    const permission = new UserFrameworkPermission({ user_id: userId, unit_id: unitId });
    await permission.save();

    return res.status(201).json({ message: 'User assigned to framework' });
  } catch (error) {
    console.error('Assign framework error:', error);
    return res.status(500).json({ error: 'Failed to assign framework' });
  }
});

// Remove user from framework (admin only)
router.delete('/remove-framework/:userId/:unitId', authMiddleware, adminOnly, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId, unitId } = req.params;

    await UserFrameworkPermission.deleteOne({ user_id: userId, unit_id: unitId });

    return res.json({ message: 'User removed from framework' });
  } catch (error) {
    console.error('Remove framework error:', error);
    return res.status(500).json({ error: 'Failed to remove framework' });
  }
});

// List all users (admin only)
router.get('/users', authMiddleware, adminOnly, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const users = await User.find({}).select('-password_hash');
    const transformedUsers = users.map(u => ({
      id: u._id.toString(),
      username: u.username,
      role: u.role,
      email: u.email,
      created_at: u.created_at,
    }));
    return res.json(transformedUsers);
  } catch (error) {
    console.error('List users error:', error);
    return res.status(500).json({ error: 'Failed to list users' });
  }
});

// Get user with their frameworks (admin only)
router.get('/users/:userId', authMiddleware, adminOnly, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId } = req.params;

    if (!userId || userId === 'undefined') {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const user = await User.findById(userId).select('-password_hash');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const permissions = await UserFrameworkPermission.find({ user_id: userId }).populate('unit_id');
    const frameworks = permissions.map(p => p.unit_id);

    const transformedUser = {
      id: user._id.toString(),
      username: user.username,
      role: user.role,
      email: user.email,
      created_at: user.created_at,
    };

    return res.json({ user: transformedUser, frameworks });
  } catch (error) {
    console.error('Get user error:', error);
    return res.status(500).json({ error: 'Failed to get user' });
  }
});

// Delete user (admin only)
router.delete('/users/:userId', authMiddleware, adminOnly, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Delete all user permissions first
    await UserFrameworkPermission.deleteMany({ user_id: userId });

    // Delete user
    await User.findByIdAndDelete(userId);

    return res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    return res.status(500).json({ error: 'Failed to delete user' });
  }
});

// Update user password (admin only)
router.put('/users/:userId/password', authMiddleware, adminOnly, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const { password } = req.body;

    if (!password || password.trim().length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    user.password_hash = hashedPassword;
    await user.save();

    return res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Update password error:', error);
    return res.status(500).json({ error: 'Failed to update password' });
  }
});

// ============ ACCESS REQUEST ENDPOINTS ============

// Get pending access requests (admin only)
router.get('/access-requests', authMiddleware, adminOnly, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const requests = await AccessRequest.find({ status: 'pending' }).sort({ requested_at: -1 });

    return res.json(
      requests.map(r => ({
        id: r._id,
        username: r.username,
        requested_at: r.requested_at,
        status: r.status,
      }))
    );
  } catch (error) {
    console.error('Get access requests error:', error);
    return res.status(500).json({ error: 'Failed to get access requests' });
  }
});

// Approve access request and create user (admin only)
router.post('/approve-access/:requestId', authMiddleware, adminOnly, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { requestId } = req.params;
    const { unitId, role = 'user' } = req.body;

    console.log('🔍 Approving access - requestId:', requestId, 'unitId:', unitId);

    if (!unitId) {
      return res.status(400).json({ error: 'Unit ID is required' });
    }

    // Find access request
    const accessRequest = await AccessRequest.findById(requestId);
    console.log('📋 Access request found:', accessRequest);
    
    if (!accessRequest) {
      return res.status(404).json({ error: 'Access request not found' });
    }

    if (accessRequest.status !== 'pending') {
      return res.status(400).json({ error: 'Request has already been reviewed' });
    }

    // Verify unit exists
    const unit = await Unit.findById(unitId);
    console.log('🏢 Unit found:', unit?.name);
    
    if (!unit) {
      return res.status(404).json({ error: 'Unit not found' });
    }

    // Create user from access request
    const user = new User({
      username: accessRequest.username,
      password_hash: accessRequest.password_hash,
      role: role === 'admin' ? 'admin' : 'user',
    });

    await user.save();
    console.log('✅ User created:', user.username);

    // Assign user to framework
    const permission = new UserFrameworkPermission({
      user_id: user._id,
      unit_id: unitId,
    });

    await permission.save();
    console.log('✅ Permission assigned');

    // Update access request status
    accessRequest.status = 'approved';
    accessRequest.reviewed_by = req.user?.id as any;
    accessRequest.reviewed_at = new Date();
    accessRequest.assigned_unit_id = unitId;

    await accessRequest.save();
    console.log('✅ Access request approved');

    return res.json({
      message: 'Access approved',
      user: {
        id: user._id,
        username: user.username,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('❌ Approve access error:', error);
    return res.status(500).json({ error: 'Failed to approve access' });
  }
});

// Reject access request (admin only)
router.post('/reject-access/:requestId', authMiddleware, adminOnly, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { requestId } = req.params;
    const { reason } = req.body;

    // Find access request
    const accessRequest = await AccessRequest.findById(requestId);
    if (!accessRequest) {
      return res.status(404).json({ error: 'Access request not found' });
    }

    if (accessRequest.status !== 'pending') {
      return res.status(400).json({ error: 'Request has already been reviewed' });
    }

    // Update status
    accessRequest.status = 'rejected';
    accessRequest.reviewed_by = req.user?.id as any;
    accessRequest.reviewed_at = new Date();
    accessRequest.rejection_reason = reason || 'Rejected by admin';

    await accessRequest.save();

    return res.json({ message: 'Access request rejected' });
  } catch (error) {
    console.error('Reject access error:', error);
    return res.status(500).json({ error: 'Failed to reject access' });
  }
});

export default router;
