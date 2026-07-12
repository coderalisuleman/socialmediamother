import express from 'express';
import { asyncHandler } from '../utils/errors.js';
import { streamFile } from '../services/files.js';

export const filesRouter = express.Router();

filesRouter.get('/:fileId', asyncHandler(streamFile));
filesRouter.head('/:fileId', asyncHandler(streamFile));

