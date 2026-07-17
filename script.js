function calculateGrowth() {
  let amount = parseFloat(document.getElementById("amount").value);
  let months = parseInt(document.getElementById("months").value);
  let rate = 0.04; // 4% monthly growth

  let projected = amount * Math.pow(1 + rate, months);
  document.getElementById("result").innerText =
    "Projected Balance: GHC " + projected.toFixed(2);
}
