const express = require("express");
const router = express.Router();
const Cart = require("../models/cart");
const Product = require("../models/product");
const Order = require("../models/orders");
const auth = require("../middleware/auth");

// @route GET /api/orders
// @desc Get User's Orders
// @acces Private
router.get("/", auth, async (req, res) => {
  try {
    // Check if Cart exist
    let orders = await Order.findOne({ ownerID: req.user.id });
    if (!orders) {
      return res.status(400).json({ msg: "Order table does not exist." });
    }

    return res.status(200).json({
      orders,
    });
  } catch (err) {
    console.log("Error ", err);
    return res.status(500).json({ msg: "Server Error" });
  }
});

module.exports = router;
