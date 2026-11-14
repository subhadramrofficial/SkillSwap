/**
 * Dynamically loads the official Razorpay Checkout modal script
 * https://checkout.razorpay.com/v1/checkout.js
 */
export const loadRazorpayScript = () => {
  return new Promise((resolve) => {
    if (typeof window !== 'undefined' && window.Razorpay) {
      return resolve(true);
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => {
      resolve(true);
    };
    script.onerror = () => {
      console.error('[Razorpay] Failed to load checkout script');
      resolve(false);
    };
    document.body.appendChild(script);
  });
};

export default loadRazorpayScript;
