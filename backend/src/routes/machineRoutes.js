import { Router } from 'express';
import {
  getAllMachines,
  getMachineById,
  createMachine,
  updateMachine,
  getMachineSensors,
  getMachinePredictions
} from '../controllers/machineController.js';
import { validateCreateMachine, validateUpdateMachine } from '../validators/machineValidator.js';

const router = Router();

router.get('/', getAllMachines);
router.post('/', validateCreateMachine, createMachine);
router.get('/:id', getMachineById);
router.patch('/:id', validateUpdateMachine, updateMachine);
router.get('/:id/sensors', getMachineSensors);
router.get('/:id/predictions', getMachinePredictions);

export default router;
