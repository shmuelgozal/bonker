import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth';
import { User, UserFrameworkPermission, Unit } from '../db/mongo';
import mongoose from 'mongoose';

/**
 * Check if user has access to a specific unit and its children
 * Admins have access to all units
 * Users can access their assigned units and all child units
 */
export async function canAccessUnit(userId: string, unitId: string | mongoose.Types.ObjectId): Promise<boolean> {
  const user = await User.findById(userId);
  if (!user) return false;

  // Admin can access everything
  if (user.role === 'admin') return true;

  // Check if user has permission for this unit or any parent unit
  const targetUnit = await Unit.findById(unitId);
  if (!targetUnit) return false;

  // Get user's assigned units
  const permissions = await UserFrameworkPermission.find({ user_id: userId });
  const assignedUnitIds = permissions.map(p => p.unit_id.toString());

  // Check if target unit is in assigned units
  if (assignedUnitIds.includes(unitId.toString())) return true;

  // Check if target unit is a child of any assigned unit
  let currentUnit: any = targetUnit;
  while (currentUnit?.parent_unit_id) {
    currentUnit = await Unit.findById(currentUnit.parent_unit_id);
    if (!currentUnit) break;
    if (assignedUnitIds.includes(currentUnit._id.toString())) return true;
  }

  return false;
}

/**
 * Get all units accessible to a user (assigned units + descendants only)
 */
export async function getAccessibleUnits(userId: string): Promise<mongoose.Types.ObjectId[]> {
  const user = await User.findById(userId);
  if (!user) return [];

  // Admin can access all units
  if (user.role === 'admin') {
    const allUnits = await Unit.find({});
    return allUnits.map(u => u._id);
  }

  // Get user's assigned units
  const permissions = await UserFrameworkPermission.find({ user_id: userId }).populate('unit_id');
  const assignedUnitIds: Set<string> = new Set(); // Use Set to avoid duplicates

  for (const permission of permissions) {
    // Extract the _id from the populated unit
    const unitDoc = permission.unit_id as any;
    const unitId = (unitDoc._id || unitDoc).toString();
    
    assignedUnitIds.add(unitId);

    // Add all child units
    async function addChildren(parentId: mongoose.Types.ObjectId) {
      const children = await Unit.find({ parent_unit_id: parentId });
      for (const child of children) {
        assignedUnitIds.add(child._id.toString());
        await addChildren(child._id);
      }
    }

    await addChildren(new mongoose.Types.ObjectId(unitId));
  }

  // Convert back to ObjectIds
  return Array.from(assignedUnitIds).map(id => new mongoose.Types.ObjectId(id));
}

/**
 * Middleware: Check if user can access a unit (from route params :unitId)
 */
export async function checkUnitAccess(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const unitId = req.params.unitId;
    if (!unitId) {
      // No unitId in params, allow to proceed (might be a general request)
      return next();
    }

    const hasAccess = await canAccessUnit(req.user.id, unitId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied to this framework' });
    }

    next();
  } catch (error) {
    return res.status(500).json({ error: 'Authorization check failed' });
  }
}

/**
 * Middleware: Check if user can access a bunker (via its unit_id)
 */
export async function checkBunkerAccess(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const bunkerId = req.params.bunkerId;
    if (!bunkerId) {
      return next();
    }

    const { Bunker } = await import('../db/mongo');
    const bunker = await Bunker.findById(bunkerId);
    if (!bunker) {
      return res.status(404).json({ error: 'Bunker not found' });
    }

    // If bunker has no unit assigned, only admin can access
    if (!bunker.unit_id) {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Access denied to this bunker' });
      }
      return next();
    }

    const hasAccess = await canAccessUnit(req.user.id, bunker.unit_id);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied to this bunker' });
    }

    next();
  } catch (error) {
    return res.status(500).json({ error: 'Authorization check failed' });
  }
}
