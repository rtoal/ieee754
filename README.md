A single-page web application containing both an IEEE 754 *Encoder* (for encoding
a decimal value into its IEEE-754 single and double precision representation), and
an IEEE 754 *Decoder* (for coverting a 32 or 64-bit hexidecimal representation
into a decimal value). 

The application works entirely in JavaScript; there is no need for a server.

You will need a modern browser, as the JavaScript code uses Uint8Array and friends.

This application incorporates Michael Mclaughlin's [big.js](https://github.com/MikeMcl/big.js)
library.

