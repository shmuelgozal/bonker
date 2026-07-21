import { Router, Request, Response } from 'express';
import { StandardTemplate } from '../db/mongo';

const router = Router();

// GET /api/templates
router.get('/', async (_req: Request, res: Response) => {
  try {
    console.log('📋 Fetching templates...');
    console.log('📋 StandardTemplate model:', StandardTemplate);
    const templates = await StandardTemplate.find().sort({ name: 1 }).lean().exec();
    console.log('📋 Found templates:', templates?.length || 0, templates);
    if (!templates) {
      return res.json([]);
    }
    const result = (templates as any[]).map(t => ({
      id: t._id,
      name: t.name,
      items: t.items || {},
      created_at: t.created_at,
      updated_at: t.updated_at,
    }));
    console.log('📋 Mapped result:', result);
    res.json(result);
  } catch (error: any) {
    console.error('❌ Error fetching templates:', error.message);
    console.error('❌ Stack:', error.stack);
    res.status(500).json({ error: `Failed to fetch templates: ${error.message}` });
  }
});

// POST /api/templates
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, items } = req.body as { name: string; items: Record<string, number> };
    if (!name || !items) return res.status(400).json({ error: 'name and items required' });

    const existing = await StandardTemplate.findOne({ name });
    if (existing) return res.status(409).json({ error: 'Template with this name already exists' });

    const template = await StandardTemplate.create({ name, items, updated_at: new Date() });
    res.status(201).json({
      id: template._id,
      name: template.name,
      items: template.items,
      created_at: template.created_at,
      updated_at: template.updated_at,
    });
  } catch (error) {
    console.error('Error creating template:', error);
    res.status(500).json({ error: 'Failed to create template' });
  }
});

// PUT /api/templates/:id
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { name, items } = req.body as { name?: string; items?: Record<string, number> };

    const template = await StandardTemplate.findByIdAndUpdate(
      req.params.id,
      {
        ...(name && { name }),
        ...(items && { items }),
        updated_at: new Date(),
      },
      { new: true }
    ).lean();

    if (!template) return res.status(404).json({ error: 'Template not found' });

    res.json({
      id: template._id,
      name: template.name,
      items: template.items,
      created_at: template.created_at,
      updated_at: template.updated_at,
    });
  } catch (error) {
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
