import { useEffect, useState, useRef } from "react";

export default function App() {
  const [ws, setWs] = useState(null);
  const wsReady = connected;
  const [roomId, setRoomId] = useState("");
  const [roomIdInput, setRoomIdInput] = useState("");
  const [avatar, setAvatar] = useState(null);
  const [partnerAvatar, setPartnerAvatar] = useState(null);
  const [status, setStatus] = useState("menu"); // menu | lobby | waiting | game
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [yourPos, setYourPos] = useState(40);
  const [opponentPos, setOpponentPos] = useState(41);
  const [distance, setDistance] = useState(1);
  const [isAnimating, setIsAnimating] = useState(false);
  const [connected, setConnected] = useState(false);
  const playerNumberRef = useRef(null);
  const wsRef = useRef(null);

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
    socket.onclose = () => {
      console.log("❌ Disconnected from server");
      setConnected(false);
      wsRef.current = null;
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
    <div style={{ padding: 20 }}>

      {status === "menu" && (
        <>
          <h2>Create / Join Room</h2>
          <button onClick={createRoom} disabled={!wsReady}>Create Room</button>
          <br /><br />
          <input
            placeholder="Enter room ID"
            value={roomIdInput}
            onChange={(e) => setRoomIdInput(e.target.value)}
          />
          <button onClick={joinRoom} disabled={!wsReady}>Join Room</button>
        </>
      )}

      {status === "lobby" && (
        <>
          <h2>Room: {roomId}</h2>

          <p>Select your avatar:</p>
          {["🐱", "🐶", "🐵", "🐰"].map((a) => (
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
        <>
          <h2>🎮 Game Started</h2>
          <p>You: {avatar}</p>
          <p>Partner: {partnerAvatar}</p>

          {currentQuestion && (
            <div>
              <h3>{currentQuestion.text}</h3>
              <button onClick={() => sendWS({ type: "ANSWER", answer: "yes" })}>
                Yes
              </button>
              <button onClick={() => sendWS({ type: "ANSWER", answer: "no" })}>
                No
              </button>
            </div>
            )}
            <div
              style={{
                position: "relative",
                width: 600,
                height: 200,
                margin: "40px auto",
                border: "2px dashed #ccc",
                overflow: "hidden"
              }}
            >
              {/* YOU */}
              <div
                style={{
                  position: "absolute",
                  left: chairToX(yourPos),
                  top: 80,
                  fontSize: "40px",
                  transition: isAnimating ? "left 0.6s ease-out" : "none"
                }}
              >
                {avatar}
              </div>

              {/* PARTNER */}
              <div
                style={{
                  position: "absolute",
                  left: chairToX(opponentPos),
                  top: 80,
                  fontSize: "40px",
                  transition: isAnimating ? "left 0.6s ease-out" : "none"
                }}
              >
                {partnerAvatar}
              </div>
            </div>
            <p>💔 Distance between you: {distance} chairs</p>
        </>
      )}
    </div>
  );
}
