// Registration Form JavaScript
console.log('Registration.js loaded successfully');

let currentStep = 1;
let selectedPlan = 'quarterly'; // Default to most popular
let formData = {};

// Initialize registration form
document.addEventListener('DOMContentLoaded', function() {
    // Set default plan selection
    document.querySelector(`[data-plan="${selectedPlan}"]`).classList.add('selected');
    
    // Add plan selection listeners
    document.querySelectorAll('.plan-card').forEach(card => {
        card.addEventListener('click', function() {
            document.querySelectorAll('.plan-card').forEach(c => c.classList.remove('selected'));
            this.classList.add('selected');
            selectedPlan = this.dataset.plan;
        });
    });
});

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
    if (currentStep <= 3) {
        document.getElementById(`step${currentStep}`).classList.add('active');
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

// Handle form submission
document.getElementById('registrationForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    if (validateCurrentStep()) {
        saveCurrentStepData();
        formData.selectedPlan = selectedPlan;
        
        // Submit to Google Sheets
        submitToGoogleSheets(formData)
            .then(() => {
                // Store user data locally for portal
                localStorage.setItem('whitecoat_user', JSON.stringify(formData));
                
                // Show success step
                currentStep = 4;
                updateStepDisplay();
            })
            .catch(error => {
                console.error('Registration error:', error);
                alert('Registration failed. Please try again.');
            });
    }
});

// Google Sheets integration function
async function submitToGoogleSheets(data) {
    const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwpqiLoH6RJ3f6QDH0RxsPaGjHt3w-jXT25SK_AIfLVHvz3z5GkqDoekezhlP1CpICH/exec';
    
    try {
        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
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
            })
        });
        
        if (!response.ok) {
            throw new Error('Failed to submit registration');
        }
        
        return response.json();
    } catch (error) {
        console.error('Google Sheets submission error:', error);
        
        // Fallback: Store locally and show message to admin
        console.log('Registration data (for manual entry):', data);
        
        // In production, you might want to queue this for retry
        // or send via email instead
        return Promise.resolve();
    }
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