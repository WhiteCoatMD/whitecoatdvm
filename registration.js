// Registration Form JavaScript
console.log('Registration.js loaded successfully');

let currentStep = 1;
let selectedPlan = 'quarterly'; // Default to most popular
let formData = {};
let appliedCoupon = null;

// Stripe configuration
const STRIPE_PUBLISHABLE_KEY = 'pk_test_51SBbwJBVZoTUglHtqwQUpgyrSh6dwETblcLwvREvJDzH1Yer6wRAMaGqpqcDReOmFH4bTbuVMRmWmeEh3bA1C7o300QpuhfDo7';

// Stripe Price IDs
const STRIPE_PRICES = {
    monthly: 'price_1SBcNuBguaMiV0x31aP7EFPq',
    monthlySpecial: 'price_1SBcNuBguaMiV0x31aP7EFPq', // Using same price for now, you'll need the $5 price ID
    quarterly: 'price_1SBcNrBguaMiV0x3wjStmi81',
    sixmonth: 'price_1SBdONBguaMiV0x3Q81xB0s9',
    yearly: 'price_1SBcNoBguaMiV0x3hTNEDc7J'
};

let stripe;
let elements;
let cardElement;

// Initialize registration form
document.addEventListener('DOMContentLoaded', function() {
    // Initialize Stripe
    initializeStripe();

    // Set default plan selection
    document.querySelector(`[data-plan="${selectedPlan}"]`).classList.add('selected');

    // Add plan selection listeners
    document.querySelectorAll('.plan-card').forEach(card => {
        card.addEventListener('click', function() {
            console.log('Plan card clicked:', this.dataset.plan);
            document.querySelectorAll('.plan-card').forEach(c => c.classList.remove('selected'));
            this.classList.add('selected');
            selectedPlan = this.dataset.plan;
            console.log('Selected plan updated to:', selectedPlan);
        });
    });
});

// Initialize Stripe
function initializeStripe() {
    if (STRIPE_PUBLISHABLE_KEY.includes('YOUR_STRIPE')) {
        console.warn('Please replace STRIPE_PUBLISHABLE_KEY with your actual Stripe publishable key');
        return;
    }

    stripe = Stripe(STRIPE_PUBLISHABLE_KEY);
    elements = stripe.elements();

    // Create card element
    cardElement = elements.create('card', {
        style: {
            base: {
                fontSize: '16px',
                color: '#424770',
                '::placeholder': {
                    color: '#aab7c4',
                },
            },
        },
    });
}

function nextStep() {
    console.log('nextStep() called, current step:', currentStep);
    if (validateCurrentStep()) {
        console.log('Validation passed, moving to next step');
        saveCurrentStepData();
        currentStep++;
        updateStepDisplay();
        updateProgressBar();
    } else {
        console.log('Validation failed');
    }
}

function prevStep() {
    if (currentStep > 1) {
        currentStep--;
        updateStepDisplay();
        updateProgressBar();
    }
}

function validateCurrentStep() {
    console.log('validateCurrentStep() called for step:', currentStep);
    const currentStepElement = document.getElementById(`step${currentStep}`);
    const requiredFields = currentStepElement.querySelectorAll('input[required], select[required]');

    console.log('Required fields found:', requiredFields.length);

    let isValid = true;
    let emptyFields = [];

    requiredFields.forEach(field => {
        console.log('Checking field:', field.name, 'value:', field.value);
        if (!field.value.trim()) {
            field.style.borderColor = '#e74c3c';
            emptyFields.push(field.previousElementSibling ? field.previousElementSibling.textContent : field.name);
            isValid = false;
            console.log('Field invalid:', field.name);
        } else {
            field.style.borderColor = '#e9ecef';
        }
    });

    // Additional validation for step 1 (passwords)
    if (currentStep === 1) {
        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        if (password && confirmPassword && password !== confirmPassword) {
            document.getElementById('confirmPassword').style.borderColor = '#e74c3c';
            alert('Passwords do not match');
            isValid = false;
        }

        if (password && password.length < 8) {
            document.getElementById('password').style.borderColor = '#e74c3c';
            alert('Password must be at least 8 characters long');
            isValid = false;
        }
    }

    if (!isValid && emptyFields.length > 0) {
        alert(`Please fill in the following required fields: ${emptyFields.join(', ')}`);
    }

    console.log('Validation result:', isValid);
    return isValid;
}

function saveCurrentStepData() {
    const currentStepElement = document.getElementById(`step${currentStep}`);
    const inputs = currentStepElement.querySelectorAll('input, select');
    
    inputs.forEach(input => {
        if (input.type !== 'password' || input.id !== 'confirmPassword') {
            formData[input.name || input.id] = input.value;
        }
    });
}

function updateStepDisplay() {
    // Hide all steps
    document.querySelectorAll('.form-step').forEach(step => {
        step.classList.remove('active');
    });

    // Show current step
    if (currentStep <= 4) {
        document.getElementById(`step${currentStep}`).classList.add('active');

        // Initialize payment step when reached
        if (currentStep === 4) {
            initializePaymentStep();
        }
    } else {
        document.getElementById('success').classList.add('active');
    }
}

function updateProgressBar() {
    document.querySelectorAll('.progress-step').forEach((step, index) => {
        if (index < currentStep) {
            step.classList.add('active');
        } else {
            step.classList.remove('active');
        }
    });
}

// Initialize payment step
function initializePaymentStep() {
    if (!cardElement) {
        console.warn('Stripe not initialized');
        return;
    }

    // Mount card element
    cardElement.mount('#card-element');

    // Handle real-time validation errors from the card Element
    cardElement.on('change', function(event) {
        const displayError = document.getElementById('card-errors');
        if (event.error) {
            displayError.textContent = event.error.message;
        } else {
            displayError.textContent = '';
        }
    });

    // Update plan summary
    updatePlanSummary();
}

function updatePlanSummary() {
    const planSummary = document.getElementById('planSummary');
    const planData = getPlanData(selectedPlan);

    let summaryHTML = `
        <div class="plan-details">
            <h4>${planData.name}</h4>
            <div class="plan-price">${planData.price}</div>
            <p class="plan-billing">${planData.billing}</p>
        </div>
    `;

    // Add discount information if applied
    if (appliedCoupon) {
        summaryHTML += `
            <div class="discount-applied">
                <div class="discount-info">
                    <span class="discount-label">Discount Applied:</span>
                    <span class="discount-details">${appliedCoupon.description} - ${appliedCoupon.durationDescription}</span>
                </div>
                <button type="button" class="remove-discount" onclick="removeDiscount()">Remove</button>
            </div>
        `;
    }

    planSummary.innerHTML = summaryHTML;
}

function getPlanData(plan) {
    const plans = {
        monthly: {
            name: 'Monthly Plan',
            price: '$24.99/month',
            billing: 'Recurring monthly billing • First month only $5',
            amount: 2499, // in cents
            firstAmount: 500 // first month special price
        },
        quarterly: {
            name: '90-Day Plan',
            price: '$49.99/90 days',
            billing: 'Recurring every 90 days • Save $25 vs monthly',
            amount: 4999
        },
        sixmonth: {
            name: '6-Month Plan',
            price: '$69.99/6 months',
            billing: 'Recurring every 6 months • Save $80 vs monthly',
            amount: 6999
        },
        yearly: {
            name: 'Yearly Plan',
            price: '$79.99/year',
            billing: 'Recurring yearly • Save $220 vs monthly • Best value!',
            amount: 7999
        }
    };
    return plans[plan];
}

// Discount code functions
async function applyDiscount() {
    const discountCode = document.getElementById('discountCode').value.trim();
    const messageElement = document.getElementById('discount-message');

    if (!discountCode) {
        messageElement.innerHTML = '<span class="error">Please enter a discount code</span>';
        return;
    }

    // Show loading state
    messageElement.innerHTML = '<span class="loading">Validating code...</span>';
    const applyButton = document.querySelector('.discount-input-group button');
    applyButton.disabled = true;
    applyButton.textContent = 'Applying...';

    try {
        const response = await fetch('/api/validate-coupon', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ couponCode: discountCode })
        });

        const result = await response.json();

        if (result.success) {
            appliedCoupon = result.coupon;
            messageElement.innerHTML = `<span class="success">✓ ${result.coupon.description} ${result.coupon.durationDescription}</span>`;

            // Update plan summary to show discount
            updatePlanSummary();

            // Disable the input and button
            document.getElementById('discountCode').disabled = true;
            applyButton.textContent = 'Applied';

        } else {
            messageElement.innerHTML = `<span class="error">${result.error}</span>`;
            appliedCoupon = null;
            applyButton.disabled = false;
            applyButton.textContent = 'Apply';
        }
    } catch (error) {
        console.error('Discount validation error:', error);
        messageElement.innerHTML = '<span class="error">Failed to validate code. Please try again.</span>';
        appliedCoupon = null;
        applyButton.disabled = false;
        applyButton.textContent = 'Apply';
    }
}

function removeDiscount() {
    appliedCoupon = null;
    document.getElementById('discountCode').value = '';
    document.getElementById('discountCode').disabled = false;
    document.getElementById('discount-message').innerHTML = '';

    const applyButton = document.querySelector('.discount-input-group button');
    applyButton.disabled = false;
    applyButton.textContent = 'Apply';

    updatePlanSummary();
}

// Handle form submission
document.getElementById('registrationForm').addEventListener('submit', function(e) {
    e.preventDefault();

    if (currentStep === 4) {
        // Process payment
        processPayment();
    } else {
        // Regular form validation
        if (validateCurrentStep()) {
            saveCurrentStepData();
            formData.selectedPlan = selectedPlan;

            // Submit to Google Sheets
            submitToGoogleSheets(formData)
                .then(() => {
                    // Store user data locally for portal
                    localStorage.setItem('whitecoat_user', JSON.stringify(formData));

                    // Show success step
                    currentStep = 5;
                    updateStepDisplay();
                })
                .catch(error => {
                    console.error('Registration error:', error);
                    alert('Registration failed. Please try again.');
                });
        }
    }
});

// Process payment with Stripe
async function processPayment() {
    if (!stripe || !cardElement) {
        alert('Payment system not initialized. Please refresh and try again.');
        return;
    }

    const planData = getPlanData(selectedPlan);
    const submitButton = document.getElementById('submitBtn');

    // Disable submit button and show loading
    submitButton.disabled = true;
    submitButton.textContent = 'Processing Payment...';

    try {
        // Create payment method
        const {error, paymentMethod} = await stripe.createPaymentMethod({
            type: 'card',
            card: cardElement,
            billing_details: {
                name: `${formData.firstName} ${formData.lastName}`,
                email: formData.email,
            },
        });

        if (error) {
            throw new Error(error.message);
        }

        // Create subscription for all plans (now all are recurring)
        await createSubscription(paymentMethod.id, planData, selectedPlan);

        // If we get here, payment was successful
        // Save registration data
        await submitToGoogleSheets(formData);

        // Store user data locally for portal
        localStorage.setItem('whitecoat_user', JSON.stringify(formData));

        // Show success step
        currentStep = 5;
        updateStepDisplay();

    } catch (error) {
        console.error('Payment error:', error);
        document.getElementById('card-errors').textContent = error.message;
    } finally {
        // Re-enable submit button
        submitButton.disabled = false;
        submitButton.textContent = 'Complete Registration & Pay';
    }
}

// Create subscription for all plans (monthly, quarterly, yearly)
async function createSubscription(paymentMethodId, planData, plan) {
    console.log('Creating subscription for:', plan, paymentMethodId);

    try {
        const response = await fetch('/api/create-subscription', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                paymentMethodId,
                priceId: STRIPE_PRICES[plan],
                plan: plan,
                couponId: appliedCoupon ? appliedCoupon.id : null,
                customerData: {
                    name: `${formData.firstName} ${formData.lastName}`,
                    email: formData.email,
                    phone: formData.phone,
                    petName: formData.petName,
                    petType: formData.petType
                }
            })
        });

        if (!response.ok) {
            throw new Error(`Subscription creation failed: ${response.statusText}`);
        }

        const result = await response.json();
        console.log('Subscription created:', result);
        return result;
    } catch (error) {
        console.error('Subscription creation error:', error);
        throw error;
    }
}

// Create one-time payment for quarterly/yearly plans
async function createOneTimePayment(paymentMethodId, planData) {
    // This would typically call your backend to create a Stripe PaymentIntent
    // For now, we'll simulate the process
    console.log('Creating one-time payment for:', paymentMethodId, planData);

    // TODO: Implement backend endpoint for one-time payment
    // const response = await fetch('/create-payment', {
    //     method: 'POST',
    //     headers: { 'Content-Type': 'application/json' },
    //     body: JSON.stringify({
    //         paymentMethodId,
    //         amount: planData.amount,
    //         customerData: formData
    //     })
    // });

    // For demo purposes, we'll resolve immediately
    return Promise.resolve({ success: true });
}

// Google Sheets integration function (CORS-free method)
async function submitToGoogleSheets(data) {
    const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwpqiLoH6RJ3f6QDH0RxsPaGjHt3w-jXT25SK_AIfLVHvz3z5GkqDoekezhlP1CpICH/exec';

    return new Promise((resolve, reject) => {
        try {
            // Create a hidden form for submission
            const form = document.createElement('form');
            form.method = 'POST';
            form.action = GOOGLE_SCRIPT_URL;
            form.target = 'hidden-iframe';
            form.style.display = 'none';

            // Create form data fields
            const formFields = {
                timestamp: new Date().toISOString(),
                firstName: data.firstName,
                lastName: data.lastName,
                email: data.email,
                phone: data.phone,
                petName: data.petName,
                petType: data.petType,
                petBreed: data.petBreed || 'Not specified',
                petAge: data.petAge,
                petWeight: data.petWeight || 'Not specified',
                selectedPlan: data.selectedPlan,
                status: 'Pending Verification'
            };

            // Add hidden inputs for each field
            for (const [key, value] of Object.entries(formFields)) {
                const input = document.createElement('input');
                input.type = 'hidden';
                input.name = key;
                input.value = value;
                form.appendChild(input);
            }

            // Create hidden iframe for form submission
            let iframe = document.getElementById('hidden-iframe');
            if (!iframe) {
                iframe = document.createElement('iframe');
                iframe.id = 'hidden-iframe';
                iframe.name = 'hidden-iframe';
                iframe.style.display = 'none';
                document.body.appendChild(iframe);
            }

            // Handle iframe load (indicates form submission complete)
            iframe.onload = function() {
                console.log('Form submitted successfully to Google Sheets');
                if (document.body.contains(form)) {
                    document.body.removeChild(form);
                }
                resolve({ success: true });
            };

            // Submit the form
            document.body.appendChild(form);
            form.submit();

            // Fallback timeout
            setTimeout(() => {
                console.log('Form submission completed (timeout fallback)');
                if (document.body.contains(form)) {
                    document.body.removeChild(form);
                }
                resolve({ success: true });
            }, 3000);

        } catch (error) {
            console.error('Google Sheets submission error:', error);
            console.log('Registration data (for manual entry):', data);
            resolve({ success: true }); // Still resolve to show success to user
        }
    });
}

// Google Apps Script code (to be deployed separately)
/*
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    
    // Open the spreadsheet (replace with your sheet ID)
    const sheet = SpreadsheetApp.openById('YOUR_SHEET_ID').getActiveSheet();
    
    // Add headers if first row
    if (sheet.getLastRow() === 0) {
      sheet.appendRow([
        'Timestamp', 'First Name', 'Last Name', 'Email', 'Phone',
        'Pet Name', 'Pet Type', 'Pet Breed', 'Pet Age', 'Pet Weight',
        'Selected Plan', 'Status'
      ]);
    }
    
    // Add the data
    sheet.appendRow([
      data.timestamp,
      data.firstName,
      data.lastName,
      data.email,
      data.phone,
      data.petName,
      data.petType,
      data.petBreed,
      data.petAge,
      data.petWeight,
      data.selectedPlan,
      data.status
    ]);
    
    return ContentService
      .createTextOutput(JSON.stringify({success: true}))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({success: false, error: error.message}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
*/