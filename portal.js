// --- 1. THE GATEKEEPER (Security) ---
(function() {
    const auth = sessionStorage.getItem("sbc_auth");
    const role = sessionStorage.getItem("user_role");
    const isLoginPage = window.location.pathname.endsWith("index.html") || window.location.pathname.endsWith("/");
    
    if ((auth !== "true" || !role) && !isLoginPage) {
        console.warn("⛔ Unauthorized. Redirecting...");
        window.location.href = "https://remyjdavis.github.io/Suburban-Brewing-Company-Portal/index.html";
    }
})();

// --- CONFIGURATION ---
// 🔴 ENSURE THIS IS YOUR MASTER SCRIPT URL
const MASTER_API_URL = "https://script.google.com/macros/s/AKfycbzzkG7_Def-aiH-cF_m0NrdJe53WqQEqRDPa4Fa0nQz9-tu7kII6XmU29N3fe5T6UDF/exec"; 
const PORTAL_ROOT = "https://remyjdavis.github.io/Suburban-Brewing-Company-Portal/";

// --- 2. ONESIGNAL INIT (Notifications) ---
window.OneSignalDeferred = window.OneSignalDeferred || [];
OneSignalDeferred.push(async function(OneSignal) {
    await OneSignal.init({
        appId: "3a6852ed-53d7-4cf0-a14b-c0102564d81d",
        serviceWorkerPath: "Suburban-Brewing-Company-Portal/OneSignalSDKWorker.js",
        serviceWorkerParam: { scope: "/Suburban-Brewing-Company-Portal/" },
        allowLocalhostAsSecureOrigin: true,
    });
    const user = sessionStorage.getItem("user_name");
    if(user) OneSignal.login(user.toLowerCase());
});

// --- 3. GLOBAL INITIALIZATION ---
window.addEventListener('load', () => {
    setupUserProfile();
    checkUnreadCount();
    setInterval(checkUnreadCount, 60000); // Poll every minute
});

// --- 4. USER PROFILE & UI ---
function setupUserProfile() {
    const name = sessionStorage.getItem("user_name") || "User";
    const title = sessionStorage.getItem("user_title") || "Staff";
    const pic = sessionStorage.getItem("user_pic") || PORTAL_ROOT + "Logo.png";
    const role = sessionStorage.getItem("user_role");

    // Header Elements
    if(document.getElementById("display-username")) document.getElementById("display-username").innerText = name;
    if(document.getElementById("display-role")) document.getElementById("display-role").innerText = title;
    if(document.getElementById("display-avatar")) {
        const img = document.getElementById("display-avatar");
        img.src = pic;
        img.onerror = function() { this.src = PORTAL_ROOT + "logo.png"; };
    }

    // Admin Console Link Logic
    const adminDiv = document.getElementById("admin-nav-link");
    if (adminDiv) {
        if (role === "Admin" || role === "Owner") {
            adminDiv.style.display = "block";
            const link = adminDiv.querySelector('a');
            if (link) {
                const isSubfolder = window.location.pathname.includes("/Brewing/") || 
                                   window.location.pathname.includes("/sales/") || 
                                   window.location.pathname.includes("/inventory/");
                link.href = isSubfolder ? "../Admin.html" : "Admin.html";
            }
        } else {
            adminDiv.style.display = "none";
        }
    }

    // Dropdown Menu
    const dropdown = document.getElementById("userDropdown");
    if (dropdown) {
        dropdown.innerHTML = `
            <a href="#" onclick="openInbox(); toggleUserMenu(event);" style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                <span>📩 Team Inbox</span>
                <span id="dropdown-badge" style="display: none; background: #ef4444; color: white; font-size: 10px; font-weight: 800; padding: 2px 8px; border-radius: 10px;">0</span>
            </a>
            <a href="#" onclick="updateUserInfo(); toggleUserMenu(event);">⚙️ Update Info</a>
            <hr style="margin:5px 0; border:0; border-top:1px solid #eee;">
            <a href="#" onclick="handleLogout()" style="color: #ef4444;">🚪 Logout</a>
        `;
    }
}

function toggleUserMenu(e) {
    if(e) e.stopPropagation();
    const d = document.getElementById("userDropdown");
    if(d) d.classList.toggle("show");
}

window.onclick = function(event) {
    if (!event.target.closest('.user-profile')) {
        const d = document.getElementById("userDropdown");
        if (d && d.classList.contains('show')) d.classList.remove('show');
    }
}

// --- 5. MESSAGING SYSTEM (Updated for Master Backend) ---

// A. Check for Unread Messages (Inbound Only)
async function checkUnreadCount() {
    try {
        const res = await fetch(`${MASTER_API_URL}?action=getInbox`);
        const messages = await res.json();
        
        if (Array.isArray(messages)) {
            // Count only 'Inbound' messages that are 'Unread'
            const count = messages.filter(m => m.direction === 'Inbound' && m.status === 'Unread').length;
            updateBadgeUI(count);
        }
    } catch(e) { console.error("Badge Error", e); }
}

function updateBadgeUI(count) {
    const outer = document.getElementById('msg-badge');
    const inner = document.getElementById('dropdown-badge');
    if (count > 0) {
        if(outer) { outer.innerText = count > 9 ? '9+' : count; outer.style.display = 'flex'; }
        if(inner) { inner.innerText = count; inner.style.display = 'inline-block'; }
    } else {
        if(outer) outer.style.display = 'none';
        if(inner) inner.style.display = 'none';
    }
}

// B. Open Team Inbox (SweetAlert Modal)
async function openInbox() {
    Swal.fire({ title: 'Loading Inbox...', didOpen: () => Swal.showLoading() });
    
    try {
        const res = await fetch(`${MASTER_API_URL}?action=getInbox`);
        const messages = await res.json();
        
        let html = '<div style="text-align:center;color:#888;padding:20px;">No messages found.</div>';
        
        if (Array.isArray(messages) && messages.length > 0) {
            html = '<div style="max-height:400px; overflow-y:auto; border:1px solid #eee; border-radius:8px; text-align:left;">';
            
            messages.forEach(m => {
                // Formatting
                const isInbound = m.direction === 'Inbound';
                const bg = m.status === "Unread" ? "#f0f9ff" : "#fff";
                const border = isInbound ? "4px solid #2563eb" : "4px solid #94a3b8";
                const icon = isInbound ? "📥" : "↩️";
                const titleStyle = m.status === "Unread" ? "font-weight:bold; color:#1e293b;" : "color:#333;";
                
                // Safe handling of data
                const safeUser = m.user || "Unknown";
                const safeTopic = m.topic || "General";
                
                html += `
                <div style="background:${bg}; padding:12px; border-bottom:1px solid #eee; border-left:${border}; cursor:pointer;"
                     onclick="readMessage('${m.id}', '${safeUser}', '${m.email}', '${safeTopic}', \`${m.text.replace(/`/g, "'")}\`)">
                    <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                        <span style="font-size:11px; color:#64748b;">${icon} ${new Date(m.date).toLocaleDateString()}</span>
                        <span style="font-size:10px; background:#e2e8f0; padding:2px 6px; border-radius:4px;">${safeTopic}</span>
                    </div>
                    <div style="${titleStyle} font-size:14px;">${safeUser}</div>
                    <div style="font-size:12px; color:#64748b; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                        ${m.text}
                    </div>
                </div>`;
            });
            html += '</div>';
        }
        
        Swal.fire({ 
            title: 'Team Inbox', 
            width: '600px', 
            html: html, 
            showConfirmButton: false, 
            showCloseButton: true 
        });

    } catch(e) { 
        console.error(e);
        Swal.fire('Error', 'Could not load inbox.', 'error'); 
    }
}

// C. Read & Reply to Message
function readMessage(id, user, email, topic, text) {
    Swal.fire({
        title: `Message from ${user}`,
        html: `
            <div style="text-align:left; font-size:14px; line-height:1.5;">
                <p><strong>Topic:</strong> ${topic}</p>
                <p><strong>Email:</strong> ${email}</p>
                <hr>
                <div style="background:#f8fafc; padding:15px; border-radius:8px; border:1px solid #e2e8f0;">
                    ${text}
                </div>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: "✉️ Reply to Client",
        cancelButtonText: "Close",
        confirmButtonColor: "#2563eb"
    }).then((result) => {
        // Mark as read immediately when opened
        // (Optional: You can add an API action for 'markRead' later)
        
        if (result.isConfirmed) {
            openReplyModal(id, user, email, topic);
        } else {
            openInbox(); // Re-open list when closed
        }
    });
}

// D. Compose Reply
async function openReplyModal(originalId, user, email, topic) {
    const { value: replyText } = await Swal.fire({
        title: `Reply to ${user}`,
        input: 'textarea',
        inputLabel: `Sending email to: ${email}`,
        inputPlaceholder: 'Type your reply here...',
        inputAttributes: { 'aria-label': 'Type your reply here' },
        showCancelButton: true,
        confirmButtonText: '🚀 Send Reply',
        confirmButtonColor: '#10b981'
    });

    if (replyText) {
        Swal.fire({ title: 'Sending...', didOpen: () => Swal.showLoading() });
        
        try {
            const payload = {
                action: 'replyToMessage',
                originalId: originalId,
                customerName: user,
                customerEmail: email,
                topic: topic,
                message: replyText
            };

            await fetch(MASTER_API_URL, {
                method: 'POST',
                mode: 'no-cors',
                body: JSON.stringify(payload)
            });

            Swal.fire('Sent!', 'Reply has been emailed to the client.', 'success');
        } catch (e) {
            Swal.fire('Error', 'Failed to send reply.', 'error');
        }
    }
}

// --- 6. PROFILE EDIT LOGIC (Unchanged) ---
async function updateUserInfo() {
    const { value: formValues } = await Swal.fire({
        title: 'Profile Settings',
        background: '#1e293b',
        color: '#ffffff',
        html: `
            <div style="text-align: center; margin-bottom: 20px;">
                <img id="preview-pic" src="${sessionStorage.getItem('user_pic') || PORTAL_ROOT + 'Logo.png'}" 
                     style="width: 80px; height: 80px; border-radius: 50%; object-fit: cover; border: 3px solid #2563eb;">
                <br>
                <button type="button" onclick="document.getElementById('file-input').click()" 
                        style="margin-top: 10px; font-size: 11px; padding: 5px 10px; background: #334155; color: white; border: none; border-radius: 4px; cursor:pointer;">
                    Change Photo
                </button>
                <input type="file" id="file-input" style="display:none;" accept="image/*" onchange="handleFileSelect(this)">
            </div>
            
            <div style="text-align: left; display: flex; flex-direction: column; gap: 15px;">
                <div style="display: flex; align-items: center;">
                    <label style="flex: 0 0 120px; font-size: 11px; color: #94a3b8; text-transform: uppercase;">Email Address</label>
                    <input id="p-email" class="swal2-input" style="margin: 0; flex: 1;" value="${sessionStorage.getItem('user_email') || ''}">
                </div>
                
                <div style="display: flex; align-items: center;">
                    <label style="flex: 0 0 120px; font-size: 11px; color: #94a3b8; text-transform: uppercase;">Phone Number</label>
                    <input id="p-phone" class="swal2-input" style="margin: 0; flex: 1;" value="${sessionStorage.getItem('user_phone') || ''}">
                </div>

                <div style="display: flex; align-items: center;">
                    <label style="flex: 0 0 120px; font-size: 11px; color: #f87171; text-transform: uppercase;">New Password</label>
                    <input id="p-pass" type="password" class="swal2-input" style="margin: 0; flex: 1;" placeholder="Leave blank to keep current">
                </div>
            </div>
        `,
        preConfirm: () => {
            return {
                email: document.getElementById('p-email').value,
                phone: document.getElementById('p-phone').value,
                pass: document.getElementById('p-pass').value,
                pic: document.getElementById('preview-pic').src
            }
        }
    });

    if (formValues) saveProfile(formValues);
}

function handleFileSelect(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) { document.getElementById('preview-pic').src = e.target.result; };
        reader.readAsDataURL(input.files[0]);
    }
}

function handleLogout() {
    sessionStorage.removeItem("sbc_auth");
    const repoPath = "/Suburban-Brewing-Company-Portal/";
    window.location.replace(repoPath + "login.html");
}

async function saveProfile(data) {
    Swal.fire({ title: 'Saving...', didOpen: () => { Swal.showLoading(); } });
    
    const username = sessionStorage.getItem("user_login_id") || sessionStorage.getItem("user_email");
    
    if (!username) {
        Swal.fire('Session Error', 'Could not identify user. Please log out and log back in.', 'error');
        return;
    }

    try {
        const response = await fetch(`${MASTER_API_URL}`, {
            method: 'POST',
            body: JSON.stringify({ action: 'updateProfile', user: username, ...data })
        });
        const result = await response.json();
        
        if (result.status === "success") {
            sessionStorage.setItem("user_pic", data.pic);
            sessionStorage.setItem("user_email", data.email);
            sessionStorage.setItem("user_phone", data.phone);
            
            setupUserProfile(); 
            Swal.fire('Saved!', 'Profile updated.', 'success');
        } else {
            throw new Error(result.message || "Update failed");
        }
    } catch (e) {
        Swal.fire('Error', 'Update Failed: ' + e.message, 'error');
    }
}
