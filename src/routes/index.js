const express = require('express');
const { asyncHandler } = require('../utils/errors');
const apiController = require('../controllers/apiController');

const router = express.Router();

router.post('/brands', asyncHandler(apiController.createBrand));
router.post('/users', asyncHandler(apiController.createUser));
router.post('/sales', asyncHandler(apiController.createSale));
router.get('/sales', asyncHandler(apiController.listSales));
router.post('/payouts/advance/run', asyncHandler(apiController.runAdvancePayout));
router.post('/admin/sales/:saleId/reconcile', asyncHandler(apiController.reconcileSale));
router.get('/users/:userId/balance', asyncHandler(apiController.getBalance));
router.get('/users/:userId/ledger', asyncHandler(apiController.getLedger));
router.post('/withdrawals', asyncHandler(apiController.createWithdrawal));
router.post('/withdrawals/:id/settle', asyncHandler(apiController.settleWithdrawal));

module.exports = router;
