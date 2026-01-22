// --- 1. THE GATEKEEPER (Security) ---
(function() {
    // 🟢 BOSS MODE: Auto-Login if key is present
    const params = new URLSearchParams(window.location.search);
    if (params.get("key") === "boss") {
        localStorage.setItem("sbc_auth", "true");
        localStorage.setItem("user_name", "Eric Yost");
        localStorage.setItem("user_role", "Owner");
        localStorage.setItem("user_access", "Admin"); 
        
        // 🟢 SET THIS TO EXACTLY WHAT YOU WANT TO SEE (e.g., "Owner", "Head Brewer")
        localStorage.setItem("user_title", "Owner"); 
        
        localStorage.setItem("sbc_driver_name", "Eric Yost");
        // Clean URL
        const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);
    } 

    const auth = localStorage.getItem("sbc_auth") === "true" || sessionStorage.getItem("sbc_auth") === "true";
    const role = localStorage.getItem("user_role") || sessionStorage.getItem("user_role");
    const isLoginPage = window.location.pathname.endsWith("index.html") || window.location.pathname.endsWith("/") || window.location.pathname.includes("login.html");
    
    // Allow boss mode or auth session
    if (!auth && !isLoginPage) {
        console.warn("⛔ Unauthorized. Redirecting...");
        const repoPath = "/Suburban-Brewing-Company-Portal/";
        window.location.href = repoPath + "login.html";
    }
})();

// --- CONFIGURATION ---
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
    const user = sessionStorage.getItem("user_name") || localStorage.getItem("user_name");
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
    // Check Local Storage first (for Boss), then Session
    const name = localStorage.getItem("user_name") || sessionStorage.getItem("user_name") || "User";
    const pic = localStorage.getItem("user_pic") || sessionStorage.getItem("user_pic") || PORTAL_ROOT + "Logo.png";
    const roleDisplay = localStorage.getItem("user_role") || sessionStorage.getItem("user_role") || "Staff";
    const accessLevel = localStorage.getItem("user_access") || sessionStorage.getItem("user_access") || "Staff";

    // A. Brute Force Overwrite (Forces Role from Column F)
    const targets = {
        "display-username": name,
        "display-role": roleDisplay,
        "menu-user-name": name,
        "menu-user-role": roleDisplay,
        "dropdown-user-name": name,
        "dropdown-user-role": roleDisplay
    };

    for (const [id, val] of Object.entries(targets)) {
        const el = document.getElementById(id);
        if (el) {
            el.innerText = val;
            el.style.visibility = "visible";
        }
    }

    // B. Universal Avatar Injection (For Hub)
    const avatars = ["avatar-img", "display-avatar"];
    avatars.forEach(id => {
        const img = document.getElementById(id);
        if (img) {
            img.src = (pic && pic !== "logo.png" && pic !== PORTAL_ROOT + "Logo.png") ? pic : "logo.png";
            img.onerror = function() { this.src = "logo.png"; };
        }
    });

    // C. Admin Console Link Logic (Based on Access Level Column G)
    const adminDiv = document.getElementById("admin-nav-link");
    const hubAdminCard = document.querySelector('a[href="Admin.html"]');

    if (accessLevel === "Admin") {
        if (adminDiv) adminDiv.style.display = "block";
        if (hubAdminCard) {
            hubAdminCard.style.display = "flex";
            hubAdminCard.parentElement.style.display = "flex";
        }
    } else {
        if (adminDiv) adminDiv.style.display = "none";
        if (hubAdminCard) {
            hubAdminCard.style.display = "none";
            if (hubAdminCard.parentElement.classList.contains('card')) hubAdminCard.parentElement.style.display = "none";
        }
    }

    // D. Dropdown Menu Injection (Desktop Only)
    const dropdown = document.getElementById("userDropdown");
    if (dropdown && dropdown.innerHTML.trim() === "") {
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

// Universal Menu Toggle
window.toggleUserMenu = function(e) {
    if(e) e.stopPropagation();
    const d = document.getElementById("userDropdown") || document.getElementById("userMenu");
    if(d) d.classList.toggle("show");
}

// Close menu when clicking outside
window.onclick = function(event) {
    if (!event.target.closest('.user-profile') && !event.target.closest('.dropdown-menu')) {
        const d = document.getElementById("userDropdown") || document.getElementById("userMenu");
        if (d && d.classList.contains('show')) d.classList.remove('show');
    }
}

// --- 5. MESSAGING SYSTEM ---

// A. Check for Unread Messages (Inbound Only)
async function checkUnreadCount() {
    try {
        const res = await fetch(`${MASTER_API_URL}?action=getInbox`);
        const messages = await res.json();
        
        if (Array.isArray(messages)) {
            const count = messages.filter(m => m.direction === 'Inbound' && m.status === 'Unread').length;
            updateBadgeUI(count);
        }
    } catch(e) { console.error("Badge Error", e); }
}

function updateBadgeUI(count) {
    const desktopOuter = document.getElementById('msg-badge');
    const desktopInner = document.getElementById('dropdown-badge');
    const mobileHeader = document.getElementById('header-badge');

    if (count > 0) {
        if(desktopOuter) { desktopOuter.innerText = count > 9 ? '9+' : count; desktopOuter.style.display = 'flex'; }
        if(desktopInner) { desktopInner.innerText = count; desktopInner.style.display = 'inline-block'; }
        if(mobileHeader) { mobileHeader.innerText = count > 9 ? '!' : count; mobileHeader.style.display = 'flex'; }
    } else {
        if(desktopOuter) desktopOuter.style.display = 'none';
        if(desktopInner) desktopInner.style.display = 'none';
        if(mobileHeader) mobileHeader.style.display = 'none';
    }
}

// B. Open Team Inbox
window.openInbox = async function() {
    const d = document.getElementById("userDropdown") || document.getElementById("userMenu");
    if(d) d.classList.remove("show");

    Swal.fire({ title: 'Loading Inbox...', didOpen: () => Swal.showLoading() });
    
    try {
        const res = await fetch(`${MASTER_API_URL}?action=getInbox`);
        const messages = await res.json();
        
        let html = '';
        
        if (Array.isArray(messages) && messages.length > 0) {
            html = '<div style="max-height:400px; overflow-y:auto; border:1px solid #eee; border-radius:8px; text-align:left;">';
            
            messages.forEach(m => {
                const isInbound = m.direction === 'Inbound';
                const bg = m.status === "Unread" ? "#f0f9ff" : "#fff";
                const border = isInbound ? "4px solid #2563eb" : "4px solid #94a3b8";
                const icon = isInbound ? "📥" : "↩️";
                const titleStyle = m.status === "Unread" ? "font-weight:bold; color:#1e293b;" : "color:#333;";
                
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
        } else {
            html = '<div style="text-align:center;color:#888;padding:20px;">No messages found.</div>';
        }
        
        // 🟢 FIX: Moved button outside of any message checks so it ALWAYS shows
        html += `<button onclick="openComposeModal()" class="swal2-confirm swal2-styled" style="width:100%; margin-top:10px; background-color:#10b981;">+ New Message</button>`;
        
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

window.readMessage = function(id, user, email, topic, text) {
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
        if (result.isConfirmed) {
            openReplyModal(id, user, email, topic);
        } else {
            openInbox(); 
        }
    });
}

async function openReplyModal(originalId, user, email, topic) {
    const { value: replyText } = await Swal.fire({
        title: `Reply to ${user}`,
        input: 'textarea',
        inputLabel: `Sending email to: ${email}`,
        inputPlaceholder: 'Type your reply here...',
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
            Swal.fire('Sent!', 'Reply emailed to client.', 'success');
        } catch (e) {
            Swal.fire('Error', 'Failed to send reply.', 'error');
        }
    }
}

window.openComposeModal = async function(to="", subj="") {
    let users = [];
    try {
        const res = await fetch(`${MASTER_API_URL}?action=getUsers`);
        const json = await res.json();
        users = json.users || [];
    } catch(e) { console.warn("User list failed."); }

    let recipientHTML = users.length > 0 
        ? `<select id="swal-to" class="swal2-input">${users.map(u => `<option value="${u.name}" ${u.name===to?'selected':''}>${u.name}</option>`).join('')}</select>`
        : `<input id="swal-to" class="swal2-input" placeholder="To: (Type Name)" value="${to}">`;

    const {value:f} = await Swal.fire({ 
        title: 'New Message', 
        html: `${recipientHTML}<input id="swal-sub" class="swal2-input" placeholder="Subject" value="${subj}"><textarea id="swal-body" class="swal2-textarea" placeholder="Message..." style="height:150px;"></textarea>`, 
        focusConfirm: false, showCancelButton: true, confirmButtonText: 'Send 🚀',
        preConfirm: () => ({ to: document.getElementById('swal-to').value, sub: document.getElementById('swal-sub').value, body: document.getElementById('swal-body').value }) 
    });
    
    if(f && f.to) {
        Swal.fire({title:'Sending...', didOpen:()=>Swal.showLoading()});
        try {
            await fetch(MASTER_API_URL, { 
                method: 'POST', mode: 'no-cors', 
                body: JSON.stringify({ action: 'sendMessage', data: { sender: localStorage.getItem("user_name"), recipient: f.to, subject: f.sub, body: f.body } }) 
            });
            Swal.fire('Sent!', 'Message sent.', 'success');
        } catch(e) { Swal.fire('Error', 'Failed to send.', 'error'); }
    }
}

// --- 6. PROFILE EDIT LOGIC ---
window.updateUserInfo = async function() {
    const { value: formValues } = await Swal.fire({
        title: 'Profile Settings',
        background: '#1e293b',
        color: '#ffffff',
        html: `
            <div style="text-align: center; margin-bottom: 20px;">
                <img id="preview-pic" src="${sessionStorage.getItem('user_pic') || localStorage.getItem('user_pic') || PORTAL_ROOT + 'Logo.png'}" 
                     style="width: 80px; height: 80px; border-radius: 50%; object-fit: cover; border: 3px solid #2563eb;">
                <br>
                <button type="button" onclick="document.getElementById('file-input').click()" 
                        style="margin-top: 10px; font-size: 11px; padding: 5px 10px; background: #334155; color: white; border: none; border-radius: 4px; cursor:pointer;">
                    Change Photo
                </button>
                <input type="file" id="file-input" style="display:none;" accept="image/*" onchange="window.handleFileSelect(this)">
            </div>
            
            <div style="text-align: left; display: flex; flex-direction: column; gap: 15px;">
                <div style="display: flex; align-items: center;">
                    <label style="flex: 0 0 120px; font-size: 11px; color: #94a3b8; text-transform: uppercase;">Email Address</label>
                    <input id="p-email" class="swal2-input" style="margin: 0; flex: 1;" value="${sessionStorage.getItem('user_email') || localStorage.getItem('user_email') || ''}">
                </div>
                
                <div style="display: flex; align-items: center;">
                    <label style="flex: 0 0 120px; font-size: 11px; color: #94a3b8; text-transform: uppercase;">Phone Number</label>
                    <input id="p-phone" class="swal2-input" style="margin: 0; flex: 1;" value="${sessionStorage.getItem('user_phone') || localStorage.getItem('user_phone') || ''}">
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

window.handleFileSelect = function(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) { document.getElementById('preview-pic').src = e.target.result; };
        reader.readAsDataURL(input.files[0]);
    }
}

window.handleLogout = function() {
    sessionStorage.clear();
    localStorage.removeItem("sbc_auth"); 
    localStorage.removeItem("user_name");
    localStorage.removeItem("user_role");
    localStorage.removeItem("user_access");
    window.location.replace(PORTAL_ROOT + "login.html");
}

async function saveProfile(data) {
    Swal.fire({ title: 'Saving...', didOpen: () => { Swal.showLoading(); } });
    const username = sessionStorage.getItem("user_login_id") || localStorage.getItem("user_login_id") || sessionStorage.getItem("user_email");
    
    if (!username) {
        Swal.fire('Session Error', 'Identify failed. Log out/in.', 'error');
        return;
    }

    try {
        const response = await fetch(`${MASTER_API_URL}`, {
            method: 'POST',
            body: JSON.stringify({ action: 'updateProfile', user: username, ...data })
        });
        const result = await response.json();
        
        if (result.status === "success") {
            const storage = localStorage.getItem("sbc_auth") ? localStorage : sessionStorage;
            storage.setItem("user_pic", data.pic);
            storage.setItem("user_email", data.email);
            storage.setItem("user_phone", data.phone);
            setupUserProfile(); 
            Swal.fire('Saved!', 'Profile updated.', 'success');
        } else {
            throw new Error(result.message || "Update failed");
        }
    } catch (e) {
        Swal.fire('Error', 'Update Failed: ' + e.message, 'error');
    }
}
