/*
 * A script that operates a form in which a user can 
 *
 * (1) type in a hexadecimal value for an IEEE-754 single- or double-precision value and have 
 *     it shown in binary (with sign, exponent, and mantissa highlighted) and its approximate
 *     decimal value; and
 * (2) type in a decimal value and see its IEEE-754 hexadecimal encodings in both single- and
 *     double-precision.
 */
$(function () {

    // The big.js defaults are too lame for us.  We need more precision!
    Big.DP = 100000;

    // It's little endian if integer 1 is encoded as 01.00.00.00
    var littleEndian = !!(new Uint8Array((new Uint32Array([1])).buffer))[0];
    
    var allZeros = /^0+$/;
    var allOnes = /^1+$/;

    // I probably should just use .toString(2) for these....
    var translate = [
        "0000", "0001", "0010", "0011", "0100", "0101", "0110", "0111",
        "1000", "1001", "1010", "1011", "1100", "1101", "1110", "1111"
    ];

    /*
     * Return a string of the form "(1.f)_2 x 2^e" where the fractional part has no trailing
     * zeros.
     */
    var formatExactValue = function (fraction, exponent) {
        return "(1." + (fraction.replace(/0+$/, "") || "0") + ")<sub>2</sub>" +
            " &times; 2<sup>" + exponent + "</sup>";
    };

    /*
     * Produces a hexidecimal string for a Uint8Array.
     */
    var byteArrayToHex = function (b) {
        var array = [];
        for (var i = 0; i < b.length; i++) {
            array[littleEndian ? "unshift" : "push"](b[i]); // couldn't resist writing this.
        }
        return array.map(function (byte) {
            var hex = byte.toString(16);
            return hex.length === 1 ? "0" + hex : "" + hex;
        }).join("");
    };

    /*
     * Determine the decimal representation of a hexidecimal character
     */
    var hexToDec = function (hexString, charLoc)
    {
        return "0123456789ABCDEF".indexOf(hexString.charAt(charLoc));
    }
    
    /*
     * Determine the various interpretations of the given hex value and render them into the
     * document.
     */
    var decodeAndUpdate = function (h) {

        // Render in binary.  Hackish.
        var b = "";
        for (var i = 0, n = h.length; i < n; i++) {
            b += translate[hexToDec(h,i)];
        }

        // Determine configuration.  This could have all been precomputed but it is fast enough.
        var exponentBits = h.length === 8 ? 8 : 11;
        var mantissaBits = (h.length * 4) - exponentBits - 1;
        var bias = Math.pow(2, exponentBits - 1) - 1;
        var minExponent = 1 - bias - mantissaBits;

        // Break up the binary representation into its pieces for easier processing.
        var s = b[0];
        var e = b.substring(1, exponentBits + 1);
        var m = b.substring(exponentBits + 1);

        var value = 0;
        var text = (s === "0" ? "+" : "-");
        var multiplier = (s === "0" ? 1 : -1);
        var exactDecimal = (s === "0" ? "" : "-");

        if (allZeros.test(e)) {
            // Zero or denormalized
            if (allZeros.test(m)) {
                text += " Zero";
                exactDecimal += "0";
            } else {
                var firstOneIndex = m.indexOf("1");
                text += formatExactValue(m.substring(firstOneIndex + 1), -bias-firstOneIndex);
                value = parseInt(m, 2) * Math.pow(2, minExponent);
                exactDecimal += new Big(parseInt(m, 2)).times(new Big(2).pow(minExponent)).toFixed();
            }

        } else if (allOnes.test(e)) {
            // Infinity or NaN
            if (allZeros.test(m)) {
                text += "&#x221E;";
                value = Infinity;
            } else {
                text = "NaN";
                value = NaN;
            }
            exactDecimal = text;

        } else {
            // Normalized
            var exponent = parseInt(e, 2) - bias;
            var mantissa = parseInt(m, 2);
            text += formatExactValue(m, exponent);
            value = (1 + (mantissa * Math.pow(2, -mantissaBits))) * Math.pow(2, exponent);
            exactDecimal += new Big(1).
                plus(new Big(mantissa).times(new Big(2).pow(-mantissaBits))).
                times(new Big(2).pow(exponent)).
                toFixed();
        }

        // All done computing, render everything.
        $("#sign").html(s);
        $("#exp").html(e);
        $("#mantissa").html(m);
        $("#description").html(text);
        $("#decimal").html(value * multiplier);
        $("#exact-decoded-decimal").html(exactDecimal);
    };

    var isValidLength = function (h) {
        return (h.length===8 || h.length===16);
    }

    /**
     * Here's the code for encoding decimal values into hex.  Here we let JavaScript do all
     * the work.
     */
    var encodeAndUpdate = function (d) {
        $("#32hex").html(byteArrayToHex(new Uint8Array((new Float32Array([d])).buffer)));
        $("#64hex").html(byteArrayToHex(new Uint8Array((new Float64Array([d])).buffer)));
        $("#printed").html(+d);
    };

    /**
     * Change the hex text box 'h' given relevant information. Assumes input is already sanitized. 
     */
    var changeHexValue = function(h, operationToPerform, lastCharDecValue, charToAppend) {
        var charIndex = h.length - 1;
        while (hexToDec(h, charIndex) === lastCharDecValue) {
            charIndex--;
        }
        var endString = "";
        for (var i = charIndex; i < h.length-1; i++) {
            endString += charToAppend
        }
        var decCharValue = hexToDec(h, charIndex);
        decCharValue += operationToPerform;
        var newH = h.substring(0,charIndex) + "0123456789ABCDEF".charAt(decCharValue) + endString
        decodeAndUpdate(newH);
        $("#hex").val(newH);
    }
    


    // Prohibit non-hex digits from even being entered into the textfield.
    $("#hex").keypress(function (e) {
        var char = String.fromCharCode(e.which);
        if (! /[\dA-Fa-f]/.test(char)) {
            e.preventDefault();
        }
    });

    // Up and down arrows for hex
    $("#hex").keydown(function (e) {
        var h = $("#hex").val().toUpperCase();
        if (isValidLength(h)){
            if (e.keyCode == 38) { // Up arrow pressed
                if (isValidLength(h) && (h != "FFFFFFFF" && h != "FFFFFFFFFFFFFFFF")) {
                    changeHexValue(h, 1, 15, "0");
                }
            }
            else if (e.keyCode == 40){ // Down arrow pressed
                if (isValidLength(h) && (h != "00000000" && h != "0000000000000000")) {
                    changeHexValue(h, -1, 0, "F");
                }
            }
        }
    });

    // Update the display after something has been entered in the decoding section.
    $("#hex").keyup(function (e) {
        var h = $("#hex").val().toUpperCase();
        if (isValidLength(h)) {
            decodeAndUpdate(h);
        } else {
            // Erase all the computed fields from the section
            $("#decoder div").html("");
            $("#decoder span").html("");
        }
    });
    
    // Update the display after something has been entered in the encoding section.
    $("#dec").keyup(function (e) {
        var d = $("#dec").val();
        if (/^-?\d+(\.\d*)?([Ee][+-]?\d+)?$/.test(d)) {
            encodeAndUpdate(d);
        } else {
            // Erase all the computed fields from the section
            $("#encoder div").html("");
            $("#encoder span").html("");
        }
    });    
});
