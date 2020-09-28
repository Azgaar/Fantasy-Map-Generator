require = require("esm")(module, {
    await: true,
    //force: true
});
module.exports = require("./desktop.js");
