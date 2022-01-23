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

    let cartProducts = await Promise.all(
      cart.products.map(async (product) => {
        const sellerProduct = await Product.findById(product.productID);
        if (!sellerProduct) {
          await Cart.findOneAndUpdate(
            { "products.productID": product.productID },
            {
              $pull: {
                products: {
                  productID: product.productID,
                },
              },
            }
          );
        } else {
          return {
            ...sellerProduct._doc,
            selectedQuantity: product.selectedQuantity,
          };
        }
      })
    );

    return res.status(200).json({
      cart,
      cartProducts,
    });
  } catch (err) {
    console.log("Error ", err);
    return res.status(500).json({ msg: "Server Error" });
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

      // Check if selected quantity is valid
      if (req.body.selectedQuantity > sellerProduct.quantity) {
        return res.status(400).json({
          msg: `Product ${sellerProduct.title} has ${sellerProduct.quantity} units available only.`,
        });
      }

      // Add Product inside cart
      const { productID, selectedQuantity } = req.body;
      cart = await Cart.findOneAndUpdate(
        { ownerID: req.user.id },
        {
          $push: {
            products: {
              productID,
              selectedQuantity,
            },
          },
        },
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

      // Check if product is available on seller end
      let sellerProduct = await Product.findById(req.params.productID);
      if (!sellerProduct) {
        return res
          .status(400)
          .json({ msg: "Product does not exist on Seller end." });
      }

      // Check if provided quantity is valid
      if (req.body.selectedQuantity > sellerProduct.quantity) {
        return res.status(400).json({
          msg: `Product ${sellerProduct.title} has ${sellerProduct.quantity} units available only.`,
        });
      }

      // Update cart product
      cart = await Cart.findOneAndUpdate(
        { "products.productID": req.params.productID },
        {
          $set: {
            "products.$.selectedQuantity": req.body.selectedQuantity,
          },
        },
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

    // Validate availability and selected quantity of Products in Cart
    cart.products.map(async (product) => {
      let sellerProduct = await Product.findById(product.productID);
      if (!sellerProduct) {
        return res.status(400).json({
          msg: `Product with ID ${product.productID} is not available.`,
        });
      }
      if (product.selectedQuantity > sellerProduct.quantity) {
        return res.status(400).json({
          msg: `Product ${sellerProduct.title} has ${sellerProduct.quantity} units available only.`,
        });
      }
    });

    // Buy all Products
    cart.products.map(async (product) => {
      let buyingProduct = await Product.findById(product.productID);
      // update each product's stock quantiity
      await Product.findByIdAndUpdate(
        product.productID,
        {
          $set: {
            quantity: buyingProduct.quantity - product.selectedQuantity,
          },
        },
        {
          $new: true,
        }
      );
      // update sales on owner end of each product
      await Order.findOneAndUpdate(
        {
          ownerID: buyingProduct.ownerID,
        },
        {
          $push: {
            products: {
              productID: product.productID,
              buyQuantity: product.selectedQuantity,
              buyerID: req.user.id,
            },
          },
        }
      );
    });

    // Update cart
    cart = await Cart.findOneAndUpdate(
      { ownerID: req.user.id },
      {
        $set: {
          products: [],
        },
      },
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

// @route DELETE /api/carts/:productID
// @desc Delete Cart Product
// @acces Private
router.delete("/:productID", auth, async (req, res) => {
  try {
    // Check if Cart exist
    let cart = await Cart.findOne({ ownerID: req.user.id });
    if (!cart) {
      return res.status(400).json({ msg: "Cart does not exist." });
    }

    // Check if product exist inside cart
    let productFound = false;
    cart.products.forEach((product) => {
      if (product.id === req.params.id) productFound = true;
    });
    if (!productFound) {
      return res
        .status(400)
        .json({ msg: "Product does not exist in your cart." });
    }

    // Remove Product inside cart
    cart = await Cart.findOneAndUpdate(
      { "products.productID": req.params.productID },
      {
        $pull: {
          products: {
            productID: req.params.productID,
          },
        },
      },
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
