// Pet Owner Portal JavaScript

let userData = {};
let pets = [];
let consultationHistory = [];

// Initialize portal
document.addEventListener('DOMContentLoaded', function() {
    loadUserData();
    updateDashboard();
    loadPets();
    loadConsultationHistory();
});

// Load user data from localStorage
function loadUserData() {
    const storedData = localStorage.getItem('whitecoat_user');
    if (storedData) {
        userData = JSON.parse(storedData);
        document.getElementById('userName').textContent = userData.firstName || 'Pet Owner';
        
        // Populate account settings
        document.getElementById('accountFirstName').value = userData.firstName || '';
        document.getElementById('accountLastName').value = userData.lastName || '';
        document.getElementById('accountEmail').value = userData.email || '';
        document.getElementById('accountPhone').value = userData.phone || '';
        
        // Load initial pet if exists
        if (userData.petName) {
            pets.push({
                id: Date.now(),
                name: userData.petName,
                type: userData.petType,
                breed: userData.petBreed || 'Mixed',
                age: userData.petAge,
                weight: userData.petWeight || 'Not specified'
            });
            savePets();
        }
    }
}

// Navigation between sections
function showSection(sectionId) {
    // Hide all sections
    document.querySelectorAll('.portal-section').forEach(section => {
        section.classList.remove('active');
    });
    
    // Remove active class from all menu items
    document.querySelectorAll('.sidebar-menu a').forEach(link => {
        link.classList.remove('active');
    });
    
    // Show selected section
    document.getElementById(sectionId).classList.add('active');
    
    // Add active class to clicked menu item
    const activeLink = document.querySelector(`[onclick="showSection('${sectionId}')"]`);
    if (activeLink) {
        activeLink.classList.add('active');
    }
    
    // Special handling for certain sections
    if (sectionId === 'pets') {
        renderPets();
    } else if (sectionId === 'consultation') {
        populateConsultationPets();
    } else if (sectionId === 'history') {
        renderConsultationHistory();
    }
}

// Dashboard functions
function updateDashboard() {
    document.getElementById('petCount').textContent = pets.length;
    document.getElementById('consultationCount').textContent = consultationHistory.length;
    
    // Update recent activity
    const activityList = document.getElementById('activityList');
    if (consultationHistory.length > 0) {
        const recentConsultations = consultationHistory.slice(-3);
        activityList.innerHTML = recentConsultations.map(consultation => `
            <div class="activity-item">
                <p><strong>${consultation.petName}</strong> - ${consultation.type}</p>
                <small>${new Date(consultation.date).toLocaleDateString()}</small>
            </div>
        `).join('');
    } else {
        activityList.innerHTML = '<p class="no-activity">No recent activity</p>';
    }
}

// Pet management functions
function loadPets() {
    const storedPets = localStorage.getItem('whitecoat_pets');
    if (storedPets) {
        pets = JSON.parse(storedPets);
    }
    updateDashboard();
}

function savePets() {
    localStorage.setItem('whitecoat_pets', JSON.stringify(pets));
    updateDashboard();
}

function renderPets() {
    const petsGrid = document.getElementById('petsGrid');
    
    if (pets.length === 0) {
        petsGrid.innerHTML = '<p class="no-pets">No pets registered yet. Click "Add New Pet" to get started!</p>';
        return;
    }
    
    petsGrid.innerHTML = pets.map(pet => `
        <div class="pet-card">
            <div class="pet-avatar">
                ${getPetEmoji(pet.type)}
            </div>
            <h3>${pet.name}</h3>
            <p>${pet.type} • ${pet.breed}</p>
            <p>${pet.age} • ${pet.weight} lbs</p>
            <button class="btn-outline" onclick="editPet(${pet.id})">Edit</button>
            <button class="btn-outline" onclick="deletePet(${pet.id})" style="margin-left: 10px; color: #e74c3c; border-color: #e74c3c;">Delete</button>
        </div>
    `).join('');
}

function getPetEmoji(type) {
    const emojis = {
        'dog': '🐕',
        'cat': '🐱',
        'bird': '🐦',
        'rabbit': '🐰',
        'other': '🐾'
    };
    return emojis[type] || '🐾';
}

function showAddPetForm() {
    document.getElementById('addPetModal').style.display = 'block';
}

function closeAddPetForm() {
    document.getElementById('addPetModal').style.display = 'none';
    // Clear form
    document.querySelectorAll('#addPetModal input, #addPetModal select').forEach(field => {
        field.value = '';
    });
}

function addPet() {
    const petData = {
        id: Date.now(),
        name: document.getElementById('newPetName').value,
        type: document.getElementById('newPetType').value,
        breed: document.getElementById('newPetBreed').value || 'Mixed',
        age: document.getElementById('newPetAge').value,
        weight: document.getElementById('newPetWeight').value || 'Not specified'
    };
    
    // Validate required fields
    if (!petData.name || !petData.type || !petData.age) {
        alert('Please fill in all required fields');
        return;
    }
    
    // Check pet limit
    if (pets.length >= 6) {
        alert('You can only register up to 6 pets per account');
        return;
    }
    
    pets.push(petData);
    savePets();
    renderPets();
    closeAddPetForm();
    
    alert(`${petData.name} has been added to your account!`);
}

function editPet(petId) {
    const pet = pets.find(p => p.id === petId);
    if (pet) {
        // Populate form with pet data
        document.getElementById('newPetName').value = pet.name;
        document.getElementById('newPetType').value = pet.type;
        document.getElementById('newPetBreed').value = pet.breed;
        document.getElementById('newPetAge').value = pet.age;
        document.getElementById('newPetWeight').value = pet.weight;
        
        // Change button to update
        const addButton = document.querySelector('#addPetModal .btn-primary');
        addButton.textContent = 'Update Pet';
        addButton.onclick = () => updatePet(petId);
        
        showAddPetForm();
    }
}

function updatePet(petId) {
    const petIndex = pets.findIndex(p => p.id === petId);
    if (petIndex !== -1) {
        pets[petIndex] = {
            id: petId,
            name: document.getElementById('newPetName').value,
            type: document.getElementById('newPetType').value,
            breed: document.getElementById('newPetBreed').value || 'Mixed',
            age: document.getElementById('newPetAge').value,
            weight: document.getElementById('newPetWeight').value || 'Not specified'
        };
        
        savePets();
        renderPets();
        closeAddPetForm();
        
        // Reset button
        const addButton = document.querySelector('#addPetModal .btn-primary');
        addButton.textContent = 'Add Pet';
        addButton.onclick = addPet;
        
        alert('Pet information updated successfully!');
    }
}

function deletePet(petId) {
    const pet = pets.find(p => p.id === petId);
    if (pet && confirm(`Are you sure you want to remove ${pet.name} from your account?`)) {
        pets = pets.filter(p => p.id !== petId);
        savePets();
        renderPets();
        alert(`${pet.name} has been removed from your account.`);
    }
}

// Consultation functions
function populateConsultationPets() {
    const petSelect = document.getElementById('consultationPet');
    petSelect.innerHTML = '<option value="">Choose a pet</option>' + 
        pets.map(pet => `<option value="${pet.id}">${pet.name} (${pet.type})</option>`).join('');
}

function requestConsultation() {
    const petId = document.getElementById('consultationPet').value;
    const type = document.getElementById('consultationType').value;
    const description = document.getElementById('consultationDescription').value;
    const urgency = document.getElementById('urgency').value;
    
    if (!petId || !type || !description) {
        alert('Please fill in all required fields');
        return;
    }
    
    const pet = pets.find(p => p.id == petId);
    const consultation = {
        id: Date.now(),
        petId: petId,
        petName: pet.name,
        type: type,
        description: description,
        urgency: urgency,
        date: new Date().toISOString(),
        status: 'Pending'
    };
    
    consultationHistory.push(consultation);
    saveConsultationHistory();
    
    // Clear form
    document.getElementById('consultationPet').value = '';
    document.getElementById('consultationType').value = '';
    document.getElementById('consultationDescription').value = '';
    document.getElementById('urgency').value = 'routine';
    
    alert('Consultation request submitted! A veterinarian will connect with you shortly.');
    
    // Submit to Google Sheets for vet notification
    submitConsultationToSheets(consultation);
}

function loadConsultationHistory() {
    const stored = localStorage.getItem('whitecoat_consultations');
    if (stored) {
        consultationHistory = JSON.parse(stored);
    }
}

function saveConsultationHistory() {
    localStorage.setItem('whitecoat_consultations', JSON.stringify(consultationHistory));
    updateDashboard();
}

function renderConsultationHistory() {
    const historyList = document.getElementById('historyList');
    const filter = document.getElementById('historyFilter').value;
    
    let filteredHistory = consultationHistory;
    if (filter !== 'all') {
        filteredHistory = consultationHistory.filter(c => c.status.toLowerCase() === filter);
    }
    
    if (filteredHistory.length === 0) {
        historyList.innerHTML = '<p class="no-history">No consultations found</p>';
        return;
    }
    
    historyList.innerHTML = filteredHistory.map(consultation => `
        <div class="history-item">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
                <div>
                    <strong>${consultation.petName}</strong> - ${consultation.type}
                    <br>
                    <small>${new Date(consultation.date).toLocaleString()}</small>
                </div>
                <span class="status-badge status-${consultation.status.toLowerCase()}">${consultation.status}</span>
            </div>
            <p>${consultation.description}</p>
            <small>Urgency: ${consultation.urgency}</small>
        </div>
    `).join('');
}

// Account functions
function updateAccount() {
    userData.firstName = document.getElementById('accountFirstName').value;
    userData.lastName = document.getElementById('accountLastName').value;
    userData.email = document.getElementById('accountEmail').value;
    userData.phone = document.getElementById('accountPhone').value;
    
    localStorage.setItem('whitecoat_user', JSON.stringify(userData));
    document.getElementById('userName').textContent = userData.firstName || 'Pet Owner';
    
    alert('Account information updated successfully!');
}

function logout() {
    if (confirm('Are you sure you want to logout?')) {
        localStorage.removeItem('whitecoat_user');
        localStorage.removeItem('whitecoat_pets');
        localStorage.removeItem('whitecoat_consultations');
        window.location.href = 'index.html';
    }
}

// Google Sheets integration for consultations
async function submitConsultationToSheets(consultation) {
    const GOOGLE_SCRIPT_URL = 'YOUR_CONSULTATION_GOOGLE_SCRIPT_URL';
    
    try {
        await fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                timestamp: consultation.date,
                userEmail: userData.email,
                userName: `${userData.firstName} ${userData.lastName}`,
                petName: consultation.petName,
                consultationType: consultation.type,
                description: consultation.description,
                urgency: consultation.urgency,
                status: consultation.status
            })
        });
    } catch (error) {
        console.error('Failed to submit consultation to sheets:', error);
        // Continue normally - consultation is still saved locally
    }
}

// Close modal when clicking outside
window.onclick = function(event) {
    const modal = document.getElementById('addPetModal');
    if (event.target === modal) {
        closeAddPetForm();
    }
}

// Filter consultation history
document.getElementById('historyFilter').addEventListener('change', renderConsultationHistory);