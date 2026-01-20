// --- 1. THE GATEKEEPER (Security) ---
(function() {
    const auth = sessionStorage.getItem("sbc_auth");
    const role = sessionStorage.getItem("user_role");
    // Get current path to avoid infinite loop on index.html
    const isLoginPage = window.location.pathname.endsWith("index.html") || window.location.pathname.endsWith("/");
    
    if ((auth !== "true" || !role) && !isLoginPage) {
        console.warn("⛔ Unauthorized. Redirecting...");
        window.location.href = "https://remyjdavis.github.io/Suburban-Brewing-Company-Portal/index.html";
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
    
    // Auto-Login Sync
    const user = sessionStorage.getItem("user_name");
    if(user) OneSignal.login(user.toLowerCase());
});

// --- 3. GLOBAL INITIALIZATION ---
window.addEventListener('load', () => {
    setupUserProfile();
    checkUnreadCount();
    setInterval(checkUnreadCount, 60000); // Check for messages every minute
});

// --- 4. USER PROFILE & UI ---
// --- 4. USER PROFILE & UI ---
function setupUserProfile() {
    const name = sessionStorage.getItem("user_name") || "User";
    const title = sessionStorage.getItem("user_title") || "Staff";
    const pic = sessionStorage.getItem("user_pic") || PORTAL_ROOT + "Logo.png";
    const role = sessionStorage.getItem("user_role");

    // Update Header Elements
    if(document.getElementById("display-username")) document.getElementById("display-username").innerText = name;
    if(document.getElementById("display-role")) document.getElementById("display-role").innerText = title;
    if(document.getElementById("display-avatar")) {
        const img = document.getElementById("display-avatar");
        img.src = pic;
        img.onerror = function() { this.src = PORTAL_ROOT + "logo.png"; };
    }

    // Inject Dropdown Menu Logic
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

// Close dropdown when clicking outside
window.onclick = function(event) {
    if (!event.target.closest('.user-profile')) {
        const d = document.getElementById("userDropdown");
        if (d && d.classList.contains('show')) d.classList.remove('show');
    }
}

// --- 5. MESSAGING SYSTEM (The Inbox) ---
async function checkUnreadCount() {
    const user = sessionStorage.getItem("user_name");
    if(!user) return;
    try {
        const res = await fetch(`${MASTER_API_URL}?action=getMessages&user=${encodeURIComponent(user)}`);
        const json = await res.json();
        if (json.status === 'success') {
            const count = json.messages.filter(m => m.status === "Unread").length;
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

async function openInbox() {
    const user = sessionStorage.getItem("user_name");
    Swal.fire({ title: 'Loading...', didOpen: () => Swal.showLoading() });
    try {
        const res = await fetch(`${MASTER_API_URL}?action=getMessages&user=${encodeURIComponent(user)}`);
        const json = await res.json();
        let html = '<div style="text-align:center;color:#888;padding:20px;">No messages.</div>';
        
        if (json.status === 'success' && json.messages.length > 0) {
            html = '<div style="max-height:400px;overflow-y:auto;border:1px solid #eee;border-radius:8px;">' + 
            json.messages.map(m => {
                const bg = m.status === "Unread" ? "#f0f9ff" : "#fff";
                const bold = m.status === "Unread" ? "font-weight:bold;" : "";
                return `
                <div style="background:${bg};padding:12px;border-bottom:1px solid #eee;display:flex;justify-content:space-between;align-items:center;">
                    <div onclick="readMessage('${m.id}','${m.from}','${m.subject}','${m.body}')" style="cursor:pointer;text-align:left;flex:1;">
                        <div style="font-size:11px;color:#666;">${new Date(m.date).toLocaleDateString()} • ${m.from}</div>
                        <div style="${bold}color:#333;">${m.subject}</div>
                    </div>
                    <button onclick="deleteMessage('${m.id}')" style="background:transparent;border:none;color:#f87171;cursor:pointer;padding:5px;">🗑️</button>
                </div>`;
            }).join('') + '</div>';
        }
        Swal.fire({ title: 'Team Inbox', width: '500px', html: html + '<button onclick="openComposeModal()" class="swal2-confirm swal2-styled" style="width:100%;margin-top:10px;">+ New Message</button>', showConfirmButton: false, showCloseButton: true });
    } catch(e) { Swal.fire('Error', 'Inbox failed.', 'error'); }
}
async function deleteMessage(id) {
    const result = await Swal.fire({
        title: 'Delete Message?',
        text: "This cannot be undone.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        confirmButtonText: 'Yes, delete it'
    });

    if (result.isConfirmed) {
        try {
            await fetch(MASTER_API_URL, {
                method: 'POST',
                body: JSON.stringify({ action: 'deleteMessage', id: id })
            });
            // Refresh the inbox view immediately
            openInbox(); 
            // Update the notification badge
            checkUnreadCount(); 
        } catch (e) {
            Swal.fire('Error', 'Could not delete message.', 'error');
        }
    }
}
function readMessage(id, from, subj, body) {
    Swal.fire({
        title: subj,
        html: `<div style="text-align:left;color:#555;"><small>From: ${from}</small><hr>${body}</div>`,
        showCancelButton: true,
        showDenyButton: true,
        confirmButtonText: "Reply",
        denyButtonText: "Delete",
        denyButtonColor: "#ef4444",
        cancelButtonText: "Close"
    }).then(r => {
        // 1. Mark read in background regardless of button clicked
        fetch(MASTER_API_URL, { 
            method: 'POST', 
            body: JSON.stringify({ action: 'markRead', id: id }) 
        }).then(checkUnreadCount);

        // 2. Handle Actions
        if (r.isConfirmed) {
            // Reply Logic
            openComposeModal(from, "Re: " + subj);
        } else if (r.isDenied) {
            // Delete Logic
            deleteMessage(id); 
        } else {
            // Just closed the message
            openInbox();
        }
    });
}
async function openComposeModal(to="", subj="") {
    // We need users list first
    let users = [];
    try {
        const res = await fetch(`${MASTER_API_URL}?action=getUsers`);
        const json = await res.json();
        users = json.users || [];
    } catch(e){}

    const options = users.map(u => `<option value="${u.name}" ${u.name===to?'selected':''}>${u.name}</option>`).join('');
    const {value:f} = await Swal.fire({ title:'Compose', html:`<select id="swal-to" class="swal2-input">${options}</select><input id="swal-sub" class="swal2-input" placeholder="Subject" value="${subj}"><textarea id="swal-body" class="swal2-textarea" placeholder="Message"></textarea>`, preConfirm: () => ({ to:document.getElementById('swal-to').value, sub:document.getElementById('swal-sub').value, body:document.getElementById('swal-body').value }) });
    
    if(f) {
        Swal.fire({title:'Sending...', didOpen:()=>Swal.showLoading()});
        await fetch(MASTER_API_URL, { method:'POST', body:JSON.stringify({action:'sendMessage', data:{sender:sessionStorage.getItem("user_name"), recipient:f.to, subject:f.sub, body:f.body}}) });
        
        // Local Notification Trigger
        if(Notification.permission === 'granted' && navigator.serviceWorker.controller) {
            navigator.serviceWorker.ready.then(reg => reg.showNotification("Message Sent", {body:`To: ${f.to}`, icon: PORTAL_ROOT+'logo.png'}));
        }
        Swal.fire('Sent!', '', 'success');
    }
}

// --- PROFILE EDIT MODAL ---
 async function updateUserInfo() {
    const { value: formValues } = await Swal.fire({
        title: 'Profile Settings',
        background: '#1e293b',
        color: '#ffffff',
        html: `
            <div style="text-align: center; margin-bottom: 20px;">
                <img id="preview-pic" src="${sessionStorage.getItem('user_pic') || PORTAL_ROOT + 'logo.png'}" 
                     style="width: 80px; height: 80px; border-radius: 50%; object-fit: cover; border: 3px solid #2563eb;">
                <br>
                <button type="button" onclick="document.getElementById('file-input').click()" 
                        style="margin-top: 10px; font-size: 11px; padding: 5px 10px; background: #334155; color: white; border: none; border-radius: 4px; cursor:pointer;">
                    Change Photo
                </button>
                <input type="file" id="file-input" style="display:none;" accept="image/*" onchange="handleFileSelect(this)">
            </div>
            <div style="text-align: left;">
                <label style="font-size: 11px; color: #94a3b8; text-transform: uppercase;">Email Address</label>
                <input id="p-email" class="swal2-input" value="${sessionStorage.getItem('user_email') || ''}">
                <label style="font-size: 11px; color: #94a3b8; text-transform: uppercase;">Phone Number</label>
                <input id="p-phone" class="swal2-input" value="${sessionStorage.getItem('user_phone') || ''}">
                <label style="font-size: 11px; color: #f87171; text-transform: uppercase;">Change Password</label>
                <input id="p-pass" type="password" class="swal2-input" placeholder="Enter new password">
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
