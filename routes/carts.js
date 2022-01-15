const express = require("express");
const router = express.Router();
const { check, validationResult } = require("express-validator");
const Cart = require("../models/cart");
const Product = require("../models/product");
const Order = require("../models/orders");
const auth = require("../middleware/auth");

// @route GET /api/carts
// @desc Get User Cart
// @acces Private
router.get("/", auth, async (req, res) => {
  try {
    // Check if Cart exist
    let cart = await Cart.findOne({ ownerID: req.user.id });
    if (!cart) {
      return res.status(400).json({ msg: "Cart does not exist." });
    }
    res.status(200).json({ cart });
  } catch (err) {
    console.log("Error ", err);
    res.status(500).json({ msg: "Server Error" });
  }
});

// @route POST /api/carts
// @desc Add Cart Product
// @acces Private
router.post(
  "/",
  [
    auth,
    [check("productID", "Please enter product ID.").not().isEmpty()],
    [check("selectedQuantity", "Please enter valid quantity.").isNumeric()],
  ],
  async (req, res) => {
    // Validate Data inside request body
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ errors: errors.array() });

    try {
      // Check if Cart exist
      let cart = await Cart.findOne({ ownerID: req.user.id });
      if (!cart) {
        return res.status(400).json({ msg: "Cart does not exist." });
      }

      //   Check if product is valid to update
      let sellerProduct = await Product.findById(req.body.productID);
      if (!sellerProduct) {
        return res
          .status(400)
          .json({ msg: "Product does not exist on Seller end." });
      }
      if (req.body.selectedQuantity > sellerProduct.quantity) {
        return res.status(400).json({
          msg: `Product ${sellerProduct.title} has ${sellerProduct.quantity} units available only.`,
        });
      }

      //   Add new product inside cart
      const changes = {
        products: [
          ...cart.products,
          {
            productID: req.body.productID,
            selectedQuantity: req.body.selectedQuantity,
          },
        ],
      };

      cart = await Cart.findByIdAndUpdate(
        cart.id,
        { $set: changes },
        { new: true }
      );

      return res.status(200).json({
        cart,
      });
    } catch (err) {
      console.log("Error ", err);
      return res.status(500).json({ msg: "Server Error" });
    }
  }
);

// @route PUT /api/carts/:productID
// @desc Update Cart Product
// @acces Private
router.put(
  "/:productID",
  [
    auth,
    [check("selectedQuantity", "Please enter valid quantity.").isNumeric()],
  ],
  async (req, res) => {
    // Validate Data inside request body
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ errors: errors.array() });

    try {
      // Check if Cart exist
      let cart = await Cart.findOne({ ownerID: req.user.id });
      if (!cart) {
        return res.status(400).json({ msg: "Cart does not exist." });
      }

      //   Check if product exist inside cart
      let productFound = false;
      cart.products.forEach((product) => {
        if (product.productID.toString() === req.params.productID)
          productFound = true;
      });
      if (!productFound) {
        return res
          .status(400)
          .json({ msg: "Product does not exist in your cart." });
      }

      //   Check if cart is valid to update
      let allProducts = cart.products.map(async (product) => {
        if (product.id.toString() === req.params.productID) {
          try {
            let sellerProduct = await Product.findById(req.params.productID);
            if (!sellerProduct) {
              return res
                .status(400)
                .json({ msg: "Product does not exist on Seller end." });
            }
            if (req.body.selectedQuantity > sellerProduct.quantity) {
              return res.status(400).json({
                msg: `Product ${sellerProduct.title} has ${sellerProduct.quantity} units available only.`,
              });
            }

            // Update Product inside Cart
            return {
              ...product,
              selectedQuantity: req.body.selectedQuantity,
            };
          } catch (err) {
            console.log("Error ", err);
            return res.status(500).json({ msg: "Server Error" });
          }
        }
        return product;
      });

      const changes = {
        products: [...allProducts],
      };

      cart = await Cart.findOneAndUpdate(
        { ownerID: req.user.id },
        { $set: changes },
        { new: true }
      );

      return res.status(200).json({
        cart,
      });
    } catch (err) {
      console.log("Error ", err);
      return res.status(500).json({ msg: "Server Error" });
    }
  }
);

// @route DELETE /api/carts/:id
// @desc Delete Cart Product
// @acces Private
router.delete("/:productID", auth, async (req, res) => {
  try {
    // Check if Cart exist
    let cart = await Cart.findOne({ ownerID: req.user.id });
    if (!cart) {
      return res.status(400).json({ msg: "Cart does not exist." });
    }

    //   Check if product exist inside cart
    let productFound = false;
    cart.products.forEach((product) => {
      if (product.id === req.params.id) productFound = true;
    });
    if (!productFound) {
      return res
        .status(400)
        .json({ msg: "Product does not exist in your cart." });
    }
    let product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(400).json({ msg: "Product does not exist" });
    }

    //   Remove Product
    cart.products = cart.products.filter(
      (product) => product.productID !== req.params.productID
    );

    const changes = {
      products: [...cart.products],
    };

    cart = await Cart.findByIdAndUpdate(
      cart.id,
      { $set: changes },
      { new: true }
    );

    return res.status(200).json({
      cart,
    });
  } catch (err) {
    console.log("Error ", err);
    return res.status(500).json({ msg: "Server Error" });
  }
});

// @route DELETE /api/carts/buy
// @desc Buy All Cart Products
// @acces Private
router.delete("/buy", auth, async (req, res) => {
  try {
    // Check if Cart exist
    let cart = await Cart.findOne({ ownerID: req.user.id });
    if (!cart) {
      return res.status(400).json({ msg: "Cart does not exist." });
    }

    // Validate All Products in Cart
    cart.products.map(async (product) => {
      let sellerProduct = await Product.findById(product.productID);
      if (product.selectedQuantity > sellerProduct.quantity) {
        return res.status(400).json({
          msg: `Product ${sellerProduct.title} has ${sellerProduct.quantity} units available only.`,
        });
      }
    });

    // (BUY PRODUCTS) Update Seller Product & Update Orders Table
    cart.products.map(async (product) => {
      // Get Seller Product
      let sellerProduct = await Product.findById(product.productID);
      // Update Stocks
      await Product.findByIdAndUpdate(
        product.productID,
        {
          $set: {
            quantity: sellerProduct.quantity - product.selectedQuantity,
          },
        },
        { new: true }
      );
      // Update Sale record
      let orders = await Order.findOne({ ownerID: req.user.id });
      await Order.findByIdAndUpdate(
        orders.id,
        {
          $set: {
            products: [
              ...orders.products,
              {
                productID: product.productID,
                buyQuantity: product.selectedQuantity,
                buyerID: req.user.id,
              },
            ],
          },
        },
        { new: true }
      );
    });

    // Update Cart
    const changes = {
      products: [],
    };
    cart = await Cart.findByIdAndUpdate(
      cart.id,
      { $set: changes },
      { new: true }
    );

    return res.status(200).json({
      cart,
    });
  } catch (err) {
    console.log("Error ", err);
    return res.status(500).json({ msg: "Server Error" });
  }
});

module.exports = router;
