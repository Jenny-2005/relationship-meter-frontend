import { useEffect, useState, useRef } from "react";

export default function App() {
  const [ws, setWs] = useState(null);
  const [roomId, setRoomId] = useState("");
  const [roomIdInput, setRoomIdInput] = useState("");
  const [avatar, setAvatar] = useState(null);
  const [partnerAvatar, setPartnerAvatar] = useState(null);
  const [status, setStatus] = useState("menu"); // menu | lobby | waiting | game
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [yourPos, setYourPos] = useState(40);
  const [opponentPos, setOpponentPos] = useState(41);
  const [distance, setDistance] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [connected, setConnected] = useState(false);
  const [selected, setSelected] = useState(null);
  const playerNumberRef = useRef(null);
  const wsRef = useRef(null);
  // Add this ref near your other refs at the top of the component
  const avatarRef = useRef(avatar);
  useEffect(() => { avatarRef.current = avatar; }, [avatar]);

  // Add this useEffect for petals
  useEffect(() => {
  const colors = ['#ffb3cc','#ffd6e8','#ff8fab','#ffc2d4','#ff85a1','#ffe4ec'];
  const shapes = ['50% 0 50% 0','0 50% 0 50%','50% 50% 0 0','0 0 50% 50%'];
  const container = document.getElementById('petals-container');
  if (!container) return;

  // clear first to avoid duplicates on re-render
  container.innerHTML = '';

  for (let i = 0; i < 80; i++) {
    const el = document.createElement('div');
    el.className = 'petal';
    const size = 8 + Math.random() * 11;
    const delay = Math.random() * 4;      // 👈 stagger sway animation
    el.style.cssText = `
      left: ${Math.random() * 100}%;
      top: ${Math.random() * 100}%;
      width: ${size}px;
      height: ${size * 0.75}px;
      background: ${colors[Math.floor(Math.random() * colors.length)]};
      border-radius: ${shapes[Math.floor(Math.random() * shapes.length)]};
      opacity: ${0.55 + Math.random() * 0.4};
      transform: rotate(${Math.random() * 360}deg);
      animation-delay: ${delay}s;
    `;
    container.appendChild(el);
  }

  return () => {
    if (container) container.innerHTML = '';
  };
}, []);
  // -------------------------------
  // CONNECT WEBSOCKET ONCE
  // -------------------------------
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (wsRef.current) return;

    const socket = new WebSocket(process.env.REACT_APP_WS_URL);
    wsRef.current = socket;

    socket.onopen = () => {
      console.log("🔗 Connected to server");
      setConnected(true);
    };
    
    socket.onmessage = (event) => {
      console.log("📩 RAW:", event.data);
      const message = JSON.parse(event.data);
      console.log("📩 PARSED:", message);
      console.log("WS MESSAGE:", message);
      console.log("STATUS BEFORE:", status, "MSG:", message.type);

      switch (message.type) {

        case "ROOM_CREATED":
          setRoomId(message.roomId);
          playerNumberRef.current = 1;
          setStatus("lobby");   // <-- IMPORTANT FIX
          alert(`Room created! Share this Room ID: ${message.roomId}`);
          break;

        case "ROOM_JOINED":
          setRoomId(message.roomId);
          playerNumberRef.current = 2;
          setStatus("lobby");   // <-- IMPORTANT FIX
          break;

        case "PLAYER_JOINED":
          // stay in lobby — partner arrived
          setStatus("lobby");
          break;

        case "WAITING_FOR_PLAYER":
          if (avatar) {
            setStatus("waiting");
          } else {
            // stay in lobby so player can pick avatar
            setStatus("lobby");
          }
          break;

        case "PARTNER_AVATAR_SELECTED":
          setPartnerAvatar(message.avatar);
          break;

        case "GAME_STARTED": {
          playerNumberRef.current = message.yourPlayerNumber;

          if (message.yourAvatar) {
            // FULL payload
            setAvatar(message.yourAvatar);
            setPartnerAvatar(message.opponentAvatar);
            setYourPos(message.yourPosition ?? 40);
            setOpponentPos(message.opponentPosition ?? 41);
          } else {
            // SHORT payload
            setAvatar(
              message.yourPlayerNumber === 1
                ? message.player1Avatar
                : message.player2Avatar
            );
            setPartnerAvatar(
              message.yourPlayerNumber === 1
                ? message.player2Avatar
                : message.player1Avatar
            );
            setYourPos(40);
            setOpponentPos(41);
          }

          setStatus("game");
          break;
        }

        case "QUESTION":
          setCurrentQuestion({
            id: message.id,
            text: message.text
          });
          setSelected(null);
          break;
        
        case "UPDATE":
          setIsAnimating(true);

          setYourPos(message.yourPosition);
          setOpponentPos(message.opponentPosition);
          setDistance(message.distance);

          setTimeout(() => {
            setIsAnimating(false);
          }, 600);

          break;

        default:
          console.warn("Unknown message:", message);
      }
    };

    socket.onclose = () => {
      console.log("❌ Disconnected from server");
      wsRef.current = null;
    };

    setWs(socket);
  }, []);

  // -------------------------------
  // SAFE SEND FUNCTION
  // -------------------------------
  const sendWS = (data) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      console.warn("⏳ WS not ready — try again");
      return;
    }
    ws.send(JSON.stringify(data));
  };

  // -------------------------------
  // CREATE / JOIN ROOM
  // -------------------------------
  const createRoom = () => {
    sendWS({ type: "CREATE_ROOM" });
  };

  const joinRoom = () => {
    if (!roomIdInput.trim()) return alert("Enter a Room ID");
    sendWS({ type: "JOIN_ROOM", roomId: roomIdInput.trim() });
  };

  // -------------------------------
  // SELECT AVATAR
  // -------------------------------
  const selectAvatar = (a) => {
    setAvatar(a);
    sendWS({
      type: "SUBMIT_AVATAR",
      roomId,
      avatar: a
    });
  };
  const chairToX = (chairIndex) => {
    if (typeof chairIndex !== "number") return 0;
    const totalWidth = 600;
    const chairWidth = totalWidth / 82;
    return chairIndex * chairWidth;
  };

  return (
   <div style={{
    minHeight: "100vh",
    width: "100%",           // 👈 add this
    background: "linear-gradient(160deg, #fff0f5 0%, #ffd6e8 40%, #ffb3cc 100%)",
    position: "relative",
    overflow: "hidden"
    }}>
    <div id="petals-container" style={{ 
      position: "fixed",     // 👈 change absolute to fixed
      top: 0, left: 0,       // 👈 explicitly set top/left
      right: 0, bottom: 0,   // 👈 explicitly set right/bottom
      zIndex: 1, 
      pointerEvents: "none" 
    }} />
    <div style={{ padding: 20 }}>

      {status === "menu" && (
        <>
          <h2>Create / Join Room</h2>
          <button onClick={createRoom} disabled={!connected}>Create Room</button>
          <br /><br />
          <input
            placeholder="Enter room ID"
            value={roomIdInput}
            onChange={(e) => setRoomIdInput(e.target.value)}
          />
          <button onClick={joinRoom} disabled={!connected}>Join Room</button>
        </>
      )}

      {status === "lobby" && (
        <>
          <h2>Room: {roomId}</h2>

          <p>Select your avatar:</p>
          {["👱‍♀️","👩‍🦳","🧑","👱‍♂️"].map((a) => (
            <button
              key={a}
              onClick={() => selectAvatar(a)}
              disabled={!!avatar}
            >
              {a}
            </button>
          ))}

          <p>Your avatar: {avatar || "Not selected"}</p>
          <p>Partner avatar: {partnerAvatar || "Waiting…"}</p>
        </>
      )}

      {status === "waiting" && <h2>Waiting for partner…</h2>}

      {status === "game" && (
        <div style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          minHeight: "100vh", // or remove if you don't want full-page centering
          padding: "20px"
        }}>
          <h2>💞 Relationship Reflection Journey 💞</h2>
          <div style={{ display: "flex", justifyContent: "space-between", width: "600px" }}>
            <p>You: {avatar}</p>
            <p>Partner: {partnerAvatar}</p>
          </div>
          <p>Room ID : {roomId}</p>
          {currentQuestion && (
            <div>
              <h3>{currentQuestion.text}</h3>
              <button 
              onClick={() => {
                sendWS({ type: "ANSWER", answer: "yes" });
                setSelected("yes");
              }}
              style={{ 
                backgroundColor: selected === "yes" ? "green" : "",
                color: selected === "yes" ? "white" : "black"
               }}
              >
                Yes
              </button>
              <button onClick={() => {
                sendWS({ type: "ANSWER", answer: "no" });
                setSelected("no");
              }}
              style={{ 
                backgroundColor: selected === "no" ? "green" : "",
                color: selected === "no" ? "white" : "black"
               }}
              >
                No
              </button>
            </div>
            )}
            <div
              style={{
                position: "relative",
                width: 600,
                height: 100,
                margin: "40px auto",
                border: "2px dashed #ccc",
                overflow: "hidden"
              }}
            >
             {/* BAR TRACK */}
              <div
                style={{
                  position: "absolute",
                  top: "50%",
                  left: 0,
                  width: "100%",
                  height: "10px",
                  background: "linear-gradient(to right, #ff4d4d, #ffd166, #06d6a0)",
                  borderRadius: "10px"
                }}
              />
              {/* YOU */}
              <div
                style={{
                  position: "absolute",
                  left: chairToX(yourPos),
                  top: "50%",
                  transform: `translateX(-50%) translateY(-50%) scale(${isAnimating ? 1.3 : 1})`,
                  fontSize: "36px",
                  transition: isAnimating ? "left 0.6s ease-out, transform 0.3s ease-in-out" : "none",
                  filter: "drop-shadow(0px 4px 4px rgba(0,0,0,0.3))"
                }}
              >
                {avatar}
              </div>

              {/* PARTNER */}
              <div
                style={{
                  position: "absolute",
                  left: chairToX(opponentPos),
                  top: "50%",
                  transform: `translateX(-50%) translateY(-50%) scale(${isAnimating ? 1.3 : 1})`,
                  fontSize: "36px",
                  transition: isAnimating ? "left 0.6s ease-out, transform 0.3s ease-in-out" : "none",
                  filter: "drop-shadow(0px 4px 4px rgba(0,0,0,0.3))"
                }}
              >
                {partnerAvatar}
              </div>
            </div>
            <p>💔 You and Your Partner is {distance} chairs apart</p>
        </div>
      )}
    </div>
    </div>
  );
}
