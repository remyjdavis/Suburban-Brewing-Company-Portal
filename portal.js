// --- 1. THE GATEKEEPER (Security) ---
(function() {
    const params = new URLSearchParams(window.location.search);
    if (params.get("key") === "boss") {
        localStorage.setItem("sbc_auth", "true");
        localStorage.setItem("user_name", "Eric Yost");
        localStorage.setItem("user_role", "Owner");
        localStorage.setItem("sbc_driver_name", "Eric Yost");
        const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);
    } 

    const auth = localStorage.getItem("sbc_auth") === "true" || sessionStorage.getItem("sbc_auth") === "true";
    const isLoginPage = window.location.pathname.endsWith("index.html") || window.location.pathname.endsWith("/") || window.location.pathname.includes("login.html");
    
    if (!auth && !isLoginPage) {
        window.location.href = "/Suburban-Brewing-Company-Portal/login.html";
    }
})();

// --- CONFIGURATION ---
const MASTER_API_URL = "https://script.google.com/macros/s/AKfycbzzkG7_Def-aiH-cF_m0NrdJe53WqQEqRDPa4Fa0nQz9-tu7kII6XmU29N3fe5T6UDF/exec"; 
const PORTAL_ROOT = "https://remyjdavis.github.io/Suburban-Brewing-Company-Portal/";

// --- 2. GLOBAL INITIALIZATION ---
window.addEventListener('load', () => {
    setupUserProfile();
    requestNotifyPermission(); // 🟢 Step 1: Ask browser for permission
    
    // Initial Checks
    checkUnreadCount(); 
    checkBusinessActivity(); // 🟢 Step 2: Check Invoices/Orders/Comments immediately
    setupHubReturn();
    updateHubIdentity();

    // Poll every 60 seconds
    setInterval(() => {
        checkUnreadCount();
        checkBusinessActivity();
    }, 60000);
});

// --- 3. NOTIFICATION SYSTEM (Frontend Logic) ---

// A. Request Permission
function requestNotifyPermission() {
    if ("Notification" in window && Notification.permission !== "granted") {
        Notification.requestPermission();
    }
}

// B. Trigger Notification (Browser + Toast)
function sendPortalNotification(title, body) {
    // 1. Browser Native Notification (Background)
    if (Notification.permission === "granted") {
        new Notification(title, { 
            body: body, 
            icon: PORTAL_ROOT + "logo.png" 
        });
    }
    
    // 2. In-App Toast (Foreground)
    const Toast = Swal.mixin({
        toast: true, position: 'top-end', 
        showConfirmButton: false, timer: 5000, timerProgressBar: true,
        didOpen: (toast) => {
            toast.addEventListener('mouseenter', Swal.stopTimer)
            toast.addEventListener('mouseleave', Swal.resumeTimer)
        }
    });
    Toast.fire({ icon: 'info', title: title, text: body });
}

// C. Poll for Invoices, Orders, Comments
async function checkBusinessActivity() {
    try {
        // Hits the Backend Action "getActivityFeed"
        const res = await fetch(`${MASTER_API_URL}?action=getActivityFeed`);
        const data = await res.json();

        // 1. INVOICE CHECK
        if (data.latestInvoice) {
            const lastInv = localStorage.getItem("last_inv_id");
            if (lastInv !== String(data.latestInvoice.id)) {
                localStorage.setItem("last_inv_id", data.latestInvoice.id);
                sendPortalNotification("🧾 New Invoice", `#${data.latestInvoice.id} created for ${data.latestInvoice.customer}`);
            }
        }

        // 2. WEB ORDER CHECK
        if (data.latestOrder) {
            const lastOrd = localStorage.getItem("last_order_id");
            if (lastOrd !== String(data.latestOrder.id)) {
                localStorage.setItem("last_order_id", data.latestOrder.id);
                sendPortalNotification("🛒 New Web Order", `#${data.latestOrder.id}: ${data.latestOrder.items}`);
            }
        }

        // 3. MARKETING COMMENT CHECK
        if (data.latestComment) {
            const lastComm = localStorage.getItem("last_comment_id");
            if (lastComm !== String(data.latestComment.id)) {
                localStorage.setItem("last_comment_id", data.latestComment.id);
                sendPortalNotification("💬 Marketing Hub", `${data.latestComment.author} commented: "${data.latestComment.text}"`);
            }
        }

    } catch (e) { console.warn("Activity sync skipped"); }
}

// --- 4. MESSAGING SYSTEM (Enhanced) ---
async function checkUnreadCount() { 
    try { 
        const res = await fetch(`${MASTER_API_URL}?action=getInbox`); 
        const messages = await res.json(); 
        
        if (Array.isArray(messages)) { 
            const unreadMessages = messages.filter(m => m.direction === 'Inbound' && m.status === 'Unread');
            updateBadgeUI(unreadMessages.length); 

            // 🟢 NOTIFICATION LOGIC
            if (unreadMessages.length > 0) {
                const newestMsg = unreadMessages[0]; // Assumes API returns sorted by newest
                const lastMsgId = localStorage.getItem("last_msg_alert");

                if (newestMsg.id !== lastMsgId) {
                    localStorage.setItem("last_msg_alert", newestMsg.id);
                    
                    // Logic: Summary vs Full Text
                    const bodyText = newestMsg.text.length > 60 
                        ? newestMsg.text.substring(0, 60) + "..." 
                        : newestMsg.text;

                    sendPortalNotification(`New Message from ${newestMsg.user}`, bodyText);
                }
            }
        } 
    } catch(e) {} 
}

function updateBadgeUI(count) { 
    const dO = document.getElementById('msg-badge'); 
    const dI = document.getElementById('dropdown-badge'); 
    const mH = document.getElementById('header-badge'); 
    
    if (count > 0) { 
        if(dO) { dO.innerText = count > 9 ? '9+' : count; dO.style.display = 'flex'; } 
        if(dI) { dI.innerText = count; dI.style.display = 'inline-block'; } 
        if(mH) { mH.innerText = count > 9 ? '!' : count; mH.style.display = 'flex'; } 
    } else { 
        if(dO) dO.style.display = 'none'; 
        if(dI) dI.style.display = 'none'; 
        if(mH) mH.style.display = 'none'; 
    } 
}

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
                html += `<div style="background:${m.status === "Unread" ? "#f0f9ff" : "#fff"}; padding:12px; border-bottom:1px solid #eee; border-left:${isInbound ? "4px solid #2563eb" : "4px solid #94a3b8"}; cursor:pointer;" onclick="readMessage('${m.id}', '${m.user}', '${m.email}', '${m.topic}', \`${m.text.replace(/`/g, "'")}\`)">
                    <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                        <span style="font-size:11px; color:#64748b;">${isInbound ? "📥" : "↩️"} ${new Date(m.date).toLocaleDateString()}</span>
                        <span style="font-size:10px; background:#e2e8f0; padding:2px 6px; border-radius:4px;">${m.topic || "General"}</span>
                    </div>
                    <div style="${m.status === 'Unread' ? 'font-weight:bold;' : ''} font-size:14px;">${m.user}</div>
                    <div style="font-size:12px; color:#64748b; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${m.text}</div>
                </div>`;
            });
            html += '</div>';
        } else {
            html = '<div style="text-align:center;color:#888;padding:20px;">No messages found.</div>';
        }
        
        html += `<button onclick="openComposeModal()" class="swal2-confirm swal2-styled" style="width:100%; margin-top:10px; background-color:#10b981;">+ New Message</button>`;
        
        Swal.fire({ title: 'Team Inbox', width: '600px', html: html, showConfirmButton: false, showCloseButton: true });
    } catch(e) { Swal.fire('Error', 'Could not load inbox.', 'error'); }
}

window.readMessage = function(id, user, email, topic, text) {
    Swal.fire({
        title: `Message from ${user}`,
        html: `<div style="text-align:left; font-size:14px; line-height:1.5;">
                <p><strong>Topic:</strong> ${topic}</p>
                <p><strong>Email:</strong> ${email}</p>
                <hr>
                <div style="background:#f8fafc; padding:15px; border-radius:8px; border:1px solid #e2e8f0;">${text}</div>
               </div>`,
        showCancelButton: true,
        confirmButtonText: "✉️ Reply",
        cancelButtonText: "Close",
        confirmButtonColor: "#2563eb"
    }).then((result) => {
        if (result.isConfirmed) openReplyModal(id, user, email, topic);
        else openInbox();
    });
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

// --- 5. UI UTILITIES ---
function setupUserProfile() {
    const name = localStorage.getItem("user_name") || sessionStorage.getItem("user_name") || "User";
    const title = localStorage.getItem("user_title") || sessionStorage.getItem("user_title") || "Staff";
    const pic = localStorage.getItem("user_pic") || sessionStorage.getItem("user_pic") || PORTAL_ROOT + "Logo.png";
    const role = localStorage.getItem("user_role") || sessionStorage.getItem("user_role");

    if(document.getElementById("display-username")) document.getElementById("display-username").innerText = name;
    if(document.getElementById("display-role")) document.getElementById("display-role").innerText = title;
    if(document.getElementById("display-avatar")) {
        const img = document.getElementById("display-avatar");
        img.src = pic;
        img.onerror = function() { this.src = PORTAL_ROOT + "logo.png"; };
    }

    const adminDiv = document.getElementById("admin-nav-link");
    if (adminDiv) {
        if (role === "Admin" || role === "Owner") {
            adminDiv.style.display = "block";
            const link = adminDiv.querySelector('a');
            if (link) {
                const isSubfolder = window.location.pathname.includes("/Brewing/") || window.location.pathname.includes("/sales/") || window.location.pathname.includes("/inventory/");
                link.href = isSubfolder ? "../Admin.html" : "Admin.html";
            }
        } else {
            adminDiv.style.display = "none";
        }
    }

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

window.toggleUserMenu = function(e) { if(e) e.stopPropagation(); const d = document.getElementById("userDropdown") || document.getElementById("userMenu"); if(d) d.classList.toggle("show"); }
window.onclick = function(event) { if (!event.target.closest('.user-profile') && !event.target.closest('.dropdown-menu')) { const d = document.getElementById("userDropdown") || document.getElementById("userMenu"); if (d && d.classList.contains('show')) d.classList.remove('show'); } }
window.handleLogout = function() { sessionStorage.clear(); localStorage.removeItem("sbc_auth"); localStorage.removeItem("user_name"); localStorage.removeItem("user_role"); window.location.replace(PORTAL_ROOT + "login.html"); }

function updateHubIdentity() {
    const roleForHub = localStorage.getItem("user_role") || "Staff";
    const nameForHub = localStorage.getItem("user_name") || "User";
    const hubRoleElement = document.getElementById("menu-user-role");
    const hubNameElement = document.getElementById("menu-user-name");
    if (hubRoleElement) { hubRoleElement.innerText = roleForHub; hubRoleElement.style.visibility = "visible"; }
    if (hubNameElement) { hubNameElement.innerText = nameForHub; }
}

function setupHubReturn() {
    if (window.innerWidth > 1024) return; 
    const isHub = window.location.pathname.endsWith("/") || window.location.pathname.includes("index.html");
    const isLogin = window.location.pathname.includes("login.html");
    if (isHub) sessionStorage.setItem("sbc_hub_mode", "active");
    if (!isHub && !isLogin && sessionStorage.getItem("sbc_hub_mode") === "active") {
        const btn = document.createElement("button");
        btn.innerHTML = "⬅ Hub";
        btn.style.cssText = `position: fixed; bottom: 20px; left: 20px; z-index: 10000; background-color: #ef4444; color: white; padding: 10px 18px; border-radius: 30px; border: none; font-weight: bold; box-shadow: 0 4px 12px rgba(0,0,0,0.3); cursor: pointer; font-family: system-ui, -apple-system, sans-serif; font-size: 14px;`;
        btn.onclick = function() { window.location.href = (typeof PORTAL_ROOT !== 'undefined' ? PORTAL_ROOT : "../") + "index.html"; };
        document.body.appendChild(btn);
    }
}
