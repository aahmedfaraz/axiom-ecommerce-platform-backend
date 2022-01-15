const mongoose = require("mongoose");

const Cart = mongoose.Schema({
  ownerID: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  },
  products: [
    {
      productID: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
      },
      selectedQuantity: {
        type: Number,
        required: true,
      },
    },
  ],
  date: {
    type: Date,
    required: true,
    default: Date.now,
  },
});

module.exports = mongoose.model("cart", Cart);
