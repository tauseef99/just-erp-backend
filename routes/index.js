//backend/routes/index.js
import express from 'express';
import authRoutes from './auth.js';
import messageRoutes from './messages.js';
import callRoutes from './calls.js'; // Make sure this is imported

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/messages', messageRoutes);
router.use('/calls', callRoutes); // Make sure this is included

export default router;