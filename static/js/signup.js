document.addEventListener('DOMContentLoaded', function() {
    
    let currentStep = 1;
    let selectedRole = '';
    
    
    const progressBar = document.getElementById('progress-bar');
    const steps = document.querySelectorAll('.progress-step');
    const stepForms = document.querySelectorAll('.form-step');
    const roleOptions = document.querySelectorAll('.role-option');
    const roleSpecificFields = document.querySelectorAll('.role-specific');
    
    
    const nextButtons = {
        1: document.getElementById('next1'),
        2: document.getElementById('next2'),
        3: document.getElementById('next3'),
        4: document.getElementById('next4')
    };
    
    const prevButtons = {
        2: document.getElementById('prev2'),
        3: document.getElementById('prev3'),
        4: document.getElementById('prev4'),
        5: document.getElementById('prev5')
    };
    
    
    roleOptions.forEach(option => {
        option.addEventListener('click', function() {
            
            roleOptions.forEach(opt => opt.classList.remove('selected'));
            
            
            this.classList.add('selected');
            
            
            selectedRole = this.getAttribute('data-role');
            
            
            updateStepTitles();
            
            
            showRoleSpecificFields();
        });
    });
    
    
    nextButtons[1].addEventListener('click', function() {
        if (!selectedRole) {
            alert('Please select your role');
            return;
        }
        goToStep(2);
    });
    
    nextButtons[2].addEventListener('click', function() {
        
        const fullname = document.getElementById('fullname').value;
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirm-password').value;
        
        if (!fullname || !email || !password || !confirmPassword) {
            alert('Please fill in all required fields');
            return;
        }
        
        
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            alert('Please enter a valid email address');
            return;
        }
        
        if (password !== confirmPassword) {
            alert('Passwords do not match');
            return;
        }
        
        if (password.length < 8) {
            alert('Password must be at least 8 characters long');
            return;
        }
        
        goToStep(3);
    });
    
    nextButtons[3].addEventListener('click', function() {
        
        let isValid = true;
        let errorField = '';
        
        if (selectedRole === 'business') {
            const companyName = document.getElementById('company-name').value;
            if (!companyName) {
                isValid = false;
                errorField = 'Company Name';
            }
        } else if (selectedRole === 'entrepreneur') {
            const ventureName = document.getElementById('venture-name').value;
            if (!ventureName) {
                isValid = false;
                errorField = 'Venture Name';
            }
        } else if (selectedRole === 'investor') {
            const firmName = document.getElementById('firm-name').value;
            if (!firmName) {
                isValid = false;
                errorField = 'Firm Name';
            }
        }
        
        if (!isValid) {
            alert(`Please fill in the required field: ${errorField}`);
            return;
        }
        
        goToStep(4);
    });
    
    nextButtons[4].addEventListener('click', function() {
        goToStep(5);
    });
    
    
    prevButtons[2].addEventListener('click', function() { goToStep(1); });
    prevButtons[3].addEventListener('click', function() { goToStep(2); });
    prevButtons[4].addEventListener('click', function() { goToStep(3); });
    prevButtons[5].addEventListener('click', function() { goToStep(4); });
    
    
    document.getElementById('submit-btn').addEventListener('click', function() {
        const terms = document.getElementById('terms').checked;
        
        if (!terms) {
            alert('Please agree to the Terms of Service and Privacy Policy');
            return;
        }
        
        
        const formData = {
            role: selectedRole,
            fullname: document.getElementById('fullname').value.trim(),
            email: document.getElementById('email').value.trim().toLowerCase(),
            password: document.getElementById('password').value,
            newsletter: document.getElementById('newsletter').checked,
            description: document.getElementById('description').value.trim()
        };
        
        
        if (selectedRole === 'business') {
            formData.companyName = document.getElementById('company-name').value.trim();
            formData.industry = document.getElementById('industry').value;
            formData.companySize = document.getElementById('company-size').value;
            
            
            const proposalTypes = [];
            document.querySelectorAll('input[name="proposal-type"]:checked').forEach(cb => {
                proposalTypes.push(cb.value);
            });
            formData.proposalTypes = proposalTypes;
            
            formData.budgetRange = document.getElementById('budget-range').value;
        } else if (selectedRole === 'entrepreneur') {
            formData.ventureName = document.getElementById('venture-name').value.trim();
            formData.ventureStage = document.getElementById('venture-stage').value;
            formData.fundingNeeded = document.getElementById('funding-needed').value;
            
            
            const needs = [];
            document.querySelectorAll('input[name="entrepreneur-needs"]:checked').forEach(cb => {
                needs.push(cb.value);
            });
            formData.needs = needs;
            
            formData.targetMarket = document.getElementById('target-market').value.trim();
        } else if (selectedRole === 'investor') {
            formData.firmName = document.getElementById('firm-name').value.trim();
            formData.investmentFocus = document.getElementById('investment-focus').value;
            formData.investmentSize = document.getElementById('investment-size').value;
            
            
            const opportunityTypes = [];
            document.querySelectorAll('input[name="opportunity-type"]:checked').forEach(cb => {
                opportunityTypes.push(cb.value);
            });
            formData.opportunityTypes = opportunityTypes;
            
            formData.geographicFocus = document.getElementById('geographic-focus').value.trim();
        }
        
        console.log("Form data to be submitted:", formData);
        
        
        const submitBtn = document.getElementById('submit-btn');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'Creating Account...';
        submitBtn.disabled = true;
        
        
        fetch("/signup", {
            method: "POST",
            headers: { 
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            body: JSON.stringify(formData)
        })
        .then(async response => {
            const data = await response.json();
            
            if (!response.ok) {
                
                throw new Error(data.msg || `Server error: ${response.status}`);
            }
            
            return data;
        })
        .then(data => {
            console.log("Server response:", data);
            
            if (data.status === "success") {
                
                alert(data.msg || "Account created successfully!");
                
                
                if (data.redirect) {
                    window.location.href = data.redirect;
                } else {
                    
                    window.location.href = `/dashboard/${selectedRole}`;
                }
            } else {
                throw new Error(data.msg || 'Unknown error occurred during signup');
            }
        })
        .catch(error => {
            console.error('Signup error:', error);
            
            
            let errorMessage = 'An error occurred during signup. Please try again.';
            
            if (error.message.includes('Email already registered')) {
                errorMessage = 'This email is already registered. Please use a different email or try logging in.';
            } else if (error.message.includes('Server error')) {
                errorMessage = 'Server is temporarily unavailable. Please try again in a few moments.';
            } else {
                errorMessage = error.message;
            }
            
            alert('Error: ' + errorMessage);
            
            
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        });
    });
    
    
    function goToStep(step) {
        
        document.getElementById(`step${currentStep}-form`).classList.remove('active');
        steps[currentStep-1].classList.remove('active');
        
        
        document.getElementById(`step${step}-form`).classList.add('active');
        steps[step-1].classList.add('active');
        
        
        const progressPercentage = ((step-1) / (steps.length-1)) * 100;
        progressBar.style.width = `${progressPercentage}%`;
        
        
        for (let i = 0; i < step-1; i++) {
            steps[i].classList.add('completed');
        }
        
        
        for (let i = step; i < steps.length; i++) {
            steps[i].classList.remove('completed');
        }
        
        
        currentStep = step;
        
        
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    
    
    function updateStepTitles() {
        const step3Title = document.getElementById('step3-title');
        const step4Title = document.getElementById('step4-title');
        
        if (selectedRole === 'business') {
            step3Title.textContent = 'Tell Us About Your Business';
            step4Title.textContent = 'Set Your Proposal Preferences';
        } else if (selectedRole === 'entrepreneur') {
            step3Title.textContent = 'Tell Us About Your Venture';
            step4Title.textContent = 'What Are You Looking For?';
        } else if (selectedRole === 'investor') {
            step3Title.textContent = 'Tell Us About Your Investment Profile';
            step4Title.textContent = 'Set Your Investment Preferences';
        }
    }
    
    
    function showRoleSpecificFields() {
        
        roleSpecificFields.forEach(field => {
            field.style.display = 'none';
        });
        
        
        const roleFields = document.getElementById(`${selectedRole}-fields`);
        const rolePreferences = document.getElementById(`${selectedRole}-preferences`);
        
        if (roleFields) {
            roleFields.style.display = 'block';
        }
        if (rolePreferences) {
            rolePreferences.style.display = 'block';
        }
    }
    
    
    function addPasswordToggle() {
        const passwordInputs = document.querySelectorAll('input[type="password"]');
        
        passwordInputs.forEach(input => {
            const wrapper = document.createElement('div');
            wrapper.style.position = 'relative';
            wrapper.style.width = '100%';
            
            input.parentNode.insertBefore(wrapper, input);
            wrapper.appendChild(input);
            
            const toggle = document.createElement('button');
            toggle.type = 'button';
            toggle.innerHTML = '👁️';
            toggle.style.position = 'absolute';
            toggle.style.right = '10px';
            toggle.style.top = '50%';
            toggle.style.transform = 'translateY(-50%)';
            toggle.style.background = 'none';
            toggle.style.border = 'none';
            toggle.style.cursor = 'pointer';
            toggle.style.fontSize = '16px';
            
            toggle.addEventListener('click', function() {
                if (input.type === 'password') {
                    input.type = 'text';
                    toggle.innerHTML = '🔒';
                } else {
                    input.type = 'password';
                    toggle.innerHTML = '👁️';
                }
            });
            
            wrapper.appendChild(toggle);
        });
    }
    
    
    addPasswordToggle();
    
    
    function addPasswordStrength() {
        const passwordInput = document.getElementById('password');
        const strengthIndicator = document.createElement('div');
        strengthIndicator.style.marginTop = '5px';
        strengthIndicator.style.fontSize = '12px';
        
        passwordInput.parentNode.appendChild(strengthIndicator);
        
        passwordInput.addEventListener('input', function() {
            const password = this.value;
            let strength = 0;
            let message = '';
            let color = 'red';
            
            if (password.length >= 8) strength++;
            if (password.match(/[a-z]/) && password.match(/[A-Z]/)) strength++;
            if (password.match(/\d/)) strength++;
            if (password.match(/[^a-zA-Z\d]/)) strength++;
            
            switch(strength) {
                case 0:
                case 1:
                    message = 'Weak';
                    color = 'red';
                    break;
                case 2:
                    message = 'Fair';
                    color = 'orange';
                    break;
                case 3:
                    message = 'Good';
                    color = 'blue';
                    break;
                case 4:
                    message = 'Strong';
                    color = 'green';
                    break;
            }
            
            strengthIndicator.textContent = `Password strength: ${message}`;
            strengthIndicator.style.color = color;
        });
    }
    
    
    addPasswordStrength();
});