const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const { check, validationResult } = require("express-validator");
const User = require("../models/user");
const Product = require("../models/product");
const config = require("config");
const bcrypt = require("bcrypt");
const auth = require("../middleware/auth");

// @route POST /api/products
// @desc Add new Product
// @acces Private
router.post(
  "/",
  [
    auth,
    [
      check("title", "Please Enter a Title.").not().isEmpty(),
      check("quantity", "Please Enter a quantity").isNumeric(),
      check("price", "Please Enter a price").isNumeric(),
      check("category", "Please Enter a category").not().isEmpty(),
      check("description", "Please Enter a Description").not().isEmpty(),
    ],
  ],
  async (req, res) => {
    // Validate Data inside request body
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ errors: errors.array() });

    try {
      const { title, quantity, price, category, description } = req.body;

      const product = new Product({
        ownerID: req.user.id,
        title,
        quantity,
        price,
        category,
        description,
      });

      await product.save();

      res.status(200).json({
        product,
      });
    } catch (err) {
      console.log("Error ", err);
      res.status(500).json({ msg: "Server Error" });
    }
  }
);

// @route GET /api/products
// @desc Get all Product
// @acces Private
router.get("/", auth, async (req, res) => {
  try {
    const products = await Product.find().select({ __v: 0 });
    res.status(200).json({ products });
  } catch (err) {
    console.log("Error ", err);
    res.status(500).json({ msg: "Server Error" });
  }
});

// @route GET /api/products/:userID
// @desc Get User Product
// @acces Private
router.get("/:userID", auth, async (req, res) => {
  try {
    if (req.params.userID !== req.user.id) {
      return res.status(401).json({
        msg: "User is not Authorized",
      });
    }
    const products = await Product.findOne({
      ownerID: req.params.userID,
    }).select({ __v: 0 });
    res.status(200).json({ products });
  } catch (err) {
    console.log("Error ", err);
    res.status(500).json({ msg: "Server Error" });
  }
});

// @route PUT /api/products/:id
// @desc Update Product
// @acces Private
router.put(
  "/:id",
  [
    auth,
    [
      check("title", "Please Enter a Title.").not().isEmpty(),
      check("quantity", "Please Enter a quantity").isNumeric(),
      check("price", "Please Enter a price").isNumeric(),
      check("category", "Please Enter a category").not().isEmpty(),
      check("description", "Please Enter a Description").not().isEmpty(),
    ],
  ],
  async (req, res) => {
    // Validate Data inside request body
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ errors: errors.array() });

    try {
      let product = await Product.findById(req.params.id);
      if (!product) {
        return res.status(400).json({ msg: "Product does not exist" });
      }

      if (product.ownerID.toString() !== req.user.id) {
        return res
          .status(401)
          .json({ msg: "User is not Authorized to update this Product" });
      }

      const { title, quantity, price, category, description } = req.body;

      const changes = {
        title,
        quantity,
        price,
        category,
        description,
      };

      product = await Product.findByIdAndUpdate(
        req.params.id,
        { $set: changes },
        { new: true }
      );

      res.status(200).json({
        product,
      });
    } catch (err) {
      console.log("Error ", err);
      res.status(500).json({ msg: "Server Error" });
    }
  }
);

// @route DELETE /api/products/:id
// @desc Delete Product
// @acces Private
router.delete("/:id", auth, async (req, res) => {
  try {
    let product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(400).json({ msg: "Product does not exist" });
    }

    if (product.ownerID.toString() !== req.user.id) {
      return res
        .status(401)
        .json({ msg: "User is not Authorized to update this Product" });
    }

    await Product.findByIdAndRemove(req.params.id);

    res.status(200).json({
      msg: "The product has been deleted",
    });
  } catch (err) {
    console.log("Error ", err);
    res.status(500).json({ msg: "Server Error" });
  }
});

module.exports = router;
