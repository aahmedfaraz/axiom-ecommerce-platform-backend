const express = require("express");
const router = express.Router();
const User = require("../models/user");
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

    let orderList = await Promise.all(
      orders.products.map(async (order) => {
        const { productID, buyQuantity, buyerID } = order;
        try {
          const product = await Product.findById(productID);
          const buyer = await User.findById(buyerID);

          let responseObject = {
            productName: "",
            buyerName: "",
            productPrice: 0,
            buyQuantity,
          };

          if (!product) {
            responseObject.productName = productID;
          } else {
            responseObject.productName = product.title;
            responseObject.productPrice = product.price;
          }
          if (!buyer) {
            responseObject.buyerName = buyerID;
          } else {
            responseObject.buyerName = buyer.name;
          }

          return responseObject;
        } catch (error) {}
      })
    );

    return res.status(200).json({
      orders,
      orderList,
    });
  } catch (err) {
    console.log("Error ", err);
    return res.status(500).json({ msg: "Server Error" });
  }
});

module.exports = router;
