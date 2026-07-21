import { Router, Request, Response } from 'express';
import { StandardTemplate } from '../db/mongo';

const router = Router();

const normalizeItems = (items: unknown): Record<string, number> => {
  if (!items) return {};

  if (items instanceof Map) {
    return Object.fromEntries(
      Array.from(items.entries()).filter(([, v]) => Number.isFinite(Number(v)) && Number(v) >= 0)
    );
  }

  if (typeof items === 'object' && !Array.isArray(items)) {
    const entries = Object.entries(items as Record<string, unknown>)
      .map(([k, v]) => [String(k).trim(), Number(v)] as const)
      .filter(([k, v]) => k.length > 0 && Number.isFinite(v) && v >= 0);
    return Object.fromEntries(entries);
  }

  return {};
};

// GET /api/templates
router.get('/', async (_req: Request, res: Response) => {
  try {
    const templates = await StandardTemplate.find().sort({ name: 1 }).lean().exec();
    const result = (templates as any[]).map(t => ({
      id: t._id,
      name: t.name,
      items: normalizeItems(t.items),
      created_at: t.created_at,
      updated_at: t.updated_at,
    }));
    res.json(result);
  } catch (error: any) {
    console.error('Error fetching templates:', error);
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

// POST /api/templates
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, items } = req.body as { name: string; items: Record<string, number> };
    const normalizedName = name?.trim();
    if (!normalizedName) return res.status(400).json({ error: 'name is required' });

    const normalizedItems = normalizeItems(items);

    const existing = await StandardTemplate.findOne({ name: normalizedName });
    if (existing) return res.status(409).json({ error: 'Template with this name already exists' });

    const template = await StandardTemplate.create({ name: normalizedName, items: normalizedItems, updated_at: new Date() });
    res.status(201).json({
      id: template._id,
      name: template.name,
      items: normalizeItems(template.items),
      created_at: template.created_at,
      updated_at: template.updated_at,
    });
  } catch (error: any) {
    if (error?.code === 11000) {
      return res.status(409).json({ error: 'Template with this name already exists' });
    }
    console.error('Error creating template:', error);
    res.status(500).json({ error: 'Failed to create template' });
  }
});

// PUT /api/templates/:id
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { name, items } = req.body as { name?: string; items?: Record<string, number> };

    const updateDoc: Record<string, unknown> = { updated_at: new Date() };

    if (name !== undefined) {
      const normalizedName = name.trim();
      if (!normalizedName) {
        return res.status(400).json({ error: 'name cannot be empty' });
      }

      const duplicate = await StandardTemplate.findOne({ name: normalizedName, _id: { $ne: req.params.id } }).lean();
      if (duplicate) {
        return res.status(409).json({ error: 'Template with this name already exists' });
      }

      updateDoc.name = normalizedName;
    }

    if (items !== undefined) {
      updateDoc.items = normalizeItems(items);
    }

    if (Object.keys(updateDoc).length === 1) {
      return res.status(400).json({ error: 'No fields provided for update' });
    }

    const template = await StandardTemplate.findByIdAndUpdate(
      req.params.id,
      updateDoc,
      { new: true }
    ).lean();

    if (!template) return res.status(404).json({ error: 'Template not found' });

    res.json({
      id: template._id,
      name: template.name,
      items: normalizeItems(template.items),
      created_at: template.created_at,
      updated_at: template.updated_at,
    });
  } catch (error: any) {
    if (error?.code === 11000) {
      return res.status(409).json({ error: 'Template with this name already exists' });
    }
    console.error('Error updating template:', error);
    res.status(500).json({ error: 'Failed to update template' });
  }
});

// DELETE /api/templates/:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const deleted = await StandardTemplate.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Template not found' });
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting template:', error);
    res.status(500).json({ error: 'Failed to delete template' });
  }
});

export default router;
