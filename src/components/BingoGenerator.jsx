import { useState, useEffect } from "react";
import html2canvas from "html2canvas";
import { PDFDocument } from "pdf-lib";

export default function BingoGenerator() {
  const [songs, setSongs] = useState([]);
  const [numCards, setNumCards] = useState(1);
  const [bingoCards, setBingoCards] = useState([]);
  const [playlistUrl, setPlaylistUrl] = useState("");

  const getSpotifyAccessToken = async () => {
    const clientId = import.meta.env.VITE_SPOTIFY_CLIENT_ID;
    const clientSecret = import.meta.env.VITE_SPOTIFY_CLIENT_SECRET;
    try {
      const response = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: "Basic " + btoa(`${clientId}:${clientSecret}`),
        },
        body: "grant_type=client_credentials",
      });
      const data = await response.json();
      return data.access_token;
    } catch (error) {
      console.error("Feil ved henting av access token:", error);
    }
  };

  const fetchSpotifySongs = async () => {
    const accessToken = await getSpotifyAccessToken();
    const playlistID = playlistUrl.split("/playlist/")[1]?.split("?")[0];

    if (!playlistID) {
      alert("Ugyldig Spotify spilleliste-URL");
      return;
    }

    try {
      const response = await fetch(
        `https://api.spotify.com/v1/playlists/${playlistID}/tracks`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const data = await response.json();
      setSongs(data.items.map((item) => item.track.name));
    } catch (error) {
      console.error("Feil ved henting av spilleliste:", error);
    }
  };

  const shuffleArray = (array) => {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  };

  const generateBingoCards = () => {
    if (songs.length < 25) {
      alert("Du må ha minst 25 sanger!");
      return;
    }
    let newCards = [];
    for (let i = 0; i < numCards; i++) {
      let shuffledSongs = [...songs];
      shuffleArray(shuffledSongs);
      newCards.push(shuffledSongs.slice(0, 25));
    }
    setBingoCards(newCards);
  };

  async function saveAsPDF() {
    const bingoCard = document.getElementById("bingoCard");
    if (!bingoCard) {
      alert("Fant ikke bingo-brettet!");
      return;
    }

    const canvas = await html2canvas(bingoCard);
    const imgData = canvas.toDataURL("image/png");

    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([600, 800]);
    const jpgImage = await pdfDoc.embedPng(imgData);
    page.drawImage(jpgImage, {
      x: 50,
      y: 50,
      width: 500,
      height: 700,
    });

    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes], { type: "application/pdf" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "bingo.pdf";
    link.click();
  }

  async function saveAsJPG() {
    const bingoCard = document.getElementById("bingoCard");
    if (!bingoCard) {
      alert("Fant ikke bingo-brettet!");
      return;
    }

    const canvas = await html2canvas(bingoCard);
    const imgData = canvas.toDataURL("image/jpeg");

    const link = document.createElement("a");
    link.href = imgData;
    link.download = "bingo.jpg";
    link.click();
  }

  return (
    <div className="p-4 text-center">
      <h1 className="text-2xl font-bold">Spotify Musikk-Bingo Generator</h1>
      <input
        type="text"
        placeholder="Spotify spilleliste-URL"
        value={playlistUrl}
        onChange={(e) => setPlaylistUrl(e.target.value)}
        className="border p-2 m-2 w-full"
      />
      <button onClick={fetchSpotifySongs} className="bg-blue-500 text-white p-2 m-2">
        Hent sanger
      </button>
      <br />
      <input
        type="number"
        min="1"
        max="10"
        value={numCards}
        onChange={(e) => setNumCards(parseInt(e.target.value, 10))}
        className="border p-2 w-20"
      />
      <button onClick={generateBingoCards} className="bg-green-500 text-white p-2 m-2">
        Generer Bingo
      </button>
      <button onClick={saveAsPDF} className="bg-red-500 text-white p-2 m-2">
        Lagre som PDF
      </button>
      <button onClick={saveAsJPG} className="bg-yellow-500 text-white p-2 m-2">
        Lagre som JPG
      </button>

      <div className="flex flex-wrap justify-center mt-4">
        {bingoCards.map((card, index) => (
          <div
            key={index}
            id="bingoCard"
            className="grid grid-cols-5 border-2 p-2 m-2 w-64 text-sm bg-white"
          >
            {card.map((song, i) => (
              <div
                key={i}
                className="border p-2 cursor-pointer hover:bg-gray-200"
              >
                {song}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
