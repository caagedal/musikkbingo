// Legg til denne CSS-klassen for A4-format øverst i filen
import { useState, useEffect } from "react";
import html2canvas from "html2canvas";
import { PDFDocument } from "pdf-lib";
import "../BingoGenerator.css";

export default function BingoGenerator() {
  const [songs, setSongs] = useState([]);
  const [numCards, setNumCards] = useState(1);
  const [bingoCards, setBingoCards] = useState([]);
  const [playlistUrl, setPlaylistUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedCells, setSelectedCells] = useState({});
  const [cardSize, setCardSize] = useState("medium");
  const [gridSize, setGridSize] = useState("5x5");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    // Logg status når bingoCards endres for å debugging
    console.log("bingoCards oppdatert:", bingoCards);
  }, [bingoCards]);

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
      setErrorMessage("Kunne ikke hente Spotify access token. Sjekk API-nøklene dine.");
      return null;
    }
  };

  const fetchSpotifySongs = async () => {
    if (!playlistUrl) {
      setErrorMessage("Skriv inn en Spotify spilleliste-URL");
      return;
    }

    setLoading(true);
    setErrorMessage("");
    
    const accessToken = await getSpotifyAccessToken();
    if (!accessToken) {
      setLoading(false);
      return;
    }
    
    const playlistID = playlistUrl.split("/playlist/")[1]?.split("?")[0];

    if (!playlistID) {
      setErrorMessage("Ugyldig Spotify spilleliste-URL");
      setLoading(false);
      return;
    }

    try {
      let allTracks = [];
      let nextUrl = `https://api.spotify.com/v1/playlists/${playlistID}/tracks?limit=100`;
      
      // Hent alle sanger fra spillelisten (håndterer spillelister med mer enn 100 sanger)
      while (nextUrl) {
        const response = await fetch(nextUrl, { 
          headers: { Authorization: `Bearer ${accessToken}` } 
        });
        
        if (!response.ok) {
          throw new Error(`API svarte med status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.items) {
          allTracks = [...allTracks, ...data.items];
        }
        
        nextUrl = data.next;
      }
      
      // Filtrer ut null-spor og hent artist + navn
      const trackList = allTracks
        .filter(item => item.track)
        .map(item => {
          const artistName = item.track.artists && item.track.artists.length > 0 
            ? item.track.artists[0].name 
            : "";
          return `${artistName} - ${item.track.name}`;
        });
      
      setSongs(trackList);
      setErrorMessage("");
      
      console.log(`Hentet ${trackList.length} sanger fra Spotify`);
    } catch (error) {
      console.error("Feil ved henting av spilleliste:", error);
      setErrorMessage(`Feil ved henting av spillelisten: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Hjelpefunksjon for å få dimensjoner fra gridSize-verdi
  const getGridDimensions = (size) => {
    const [rows, cols] = size.split('x').map(num => parseInt(num, 10));
    return { rows, cols };
  };

  const shuffleArray = (array) => {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
  };

  const generateBingoCards = () => {
    console.log("generateBingoCards kjører...");
    
    const { rows, cols } = getGridDimensions(gridSize);
    const requiredSongs = rows * cols;
    
    console.log(`Trenger ${requiredSongs} sanger, har ${songs.length} sanger`);
    
    if (songs.length < requiredSongs) {
      setErrorMessage(`Du må ha minst ${requiredSongs} sanger! Du har ${songs.length} sanger.`);
      return;
    }
    
    setErrorMessage("");
    
    // Begrens antall kort til mellom 1 og 50
    const cardCount = Math.min(Math.max(1, numCards), 50);
    
    let newCards = [];
    for (let i = 0; i < cardCount; i++) {
      let shuffledSongs = shuffleArray(songs);
      let cardSongs = shuffledSongs.slice(0, requiredSongs);
      
      newCards.push({
        songs: cardSongs,
        dimensions: { rows, cols }
      });
    }
    
    console.log(`Genererte ${newCards.length} bingokort`);
    setBingoCards(newCards);
    setSelectedCells({}); // Nullstill valgte celler
  };

  const toggleCell = (cardIndex, cellIndex) => {
    setSelectedCells(prev => {
      const key = `${cardIndex}-${cellIndex}`;
      const updatedCells = { ...prev };
      
      updatedCells[key] = !prev[key];
      
      return updatedCells;
    });
  };

  // Generer header basert på antall kolonner
  const generateHeader = (cols) => {
    // Standardheader for 5 kolonner (B-I-N-G-O)
    const defaultHeader = ['B', 'I', 'N', 'G', 'O'];
    
    // For andre størrelser, bruker vi alfabetet
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    
    let header;
    if (cols === 5) {
      header = defaultHeader;
    } else {
      header = alphabet.slice(0, cols).split('');
    }
    
    return header.map((letter, index) => (
      <div key={`header-${index}`} className="font-bold text-center p-2 border-b-2 border-black">
        {letter}
      </div>
    ));
  };

  // Bestem størrelsen på kortene
  const getCardSizeClass = () => {
    switch (cardSize) {
      case "small": return "w-64 text-xs";
      case "medium": return "w-80 text-sm";
      case "large": return "w-full max-w-a4 text-base"; // A4-optimalisert størrelse
      default: return "w-80 text-sm"; // medium
    }
  };

  // Bestem antall kort per rad i layouten
  const getGridClass = () => {
    switch (cardSize) {
      case "small": return "grid-cols-2 md:grid-cols-3";
      case "large": return "grid-cols-1";
      default: return "grid-cols-1 md:grid-cols-2"; // medium
    }
  };

  const saveAllAsPDF = async () => {
    if (bingoCards.length === 0) {
      setErrorMessage("Generer bingokort først!");
      return;
    }
    
    try {
      setLoading(true);
      const pdfDoc = await PDFDocument.create();
      
      // Lagre hvert kort som en side i PDF-en
      for (let i = 0; i < bingoCards.length; i++) {
        const cardElement = document.getElementById(`bingoCard-${i}`);
        if (!cardElement) {
          console.warn(`Fant ikke element med ID bingoCard-${i}`);
          continue;
        }
        
        const canvas = await html2canvas(cardElement, {
          scale: 2, // Høyere kvalitet
          useCORS: true,
          logging: false
        });
        
        const imgData = canvas.toDataURL("image/png");
        // A4 format i punkter (595 x 842 punkter)
        const page = pdfDoc.addPage([595, 842]);
        const pngImage = await pdfDoc.embedPng(imgData);
        
        // Beregn riktig størrelse for bildet - tilpass til A4
        const { width, height } = pngImage.size();
        const aspectRatio = width / height;
        
        const pageWidth = 595;
        const pageHeight = 842;
        const margin = 50; // 50 punkter margin
        
        const maxWidth = pageWidth - (margin * 2);
        const maxHeight = pageHeight - (margin * 2);
        
        let drawWidth = maxWidth;
        let drawHeight = drawWidth / aspectRatio;
        
        if (drawHeight > maxHeight) {
          drawHeight = maxHeight;
          drawWidth = drawHeight * aspectRatio;
        }
        
        page.drawImage(pngImage, {
          x: (pageWidth - drawWidth) / 2,
          y: (pageHeight - drawHeight) / 2,
          width: drawWidth,
          height: drawHeight,
        });
      }
      
      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: "application/pdf" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "musikkbingo.pdf";
      link.click();
      setErrorMessage("");
    } catch (error) {
      console.error("Feil ved generering av PDF:", error);
      setErrorMessage("Det oppstod en feil ved lagring av PDF.");
    } finally {
      setLoading(false);
    }
  };

  const saveCardAsJPG = async (cardIndex) => {
    const cardElement = document.getElementById(`bingoCard-${cardIndex}`);
    if (!cardElement) {
      setErrorMessage("Fant ikke bingo-brettet!");
      return;
    }
    
    setLoading(true);
    try {
      const canvas = await html2canvas(cardElement, {
        scale: 2, // Høyere kvalitet
        useCORS: true
      });
      const imgData = canvas.toDataURL("image/jpeg", 0.95);
      
      const link = document.createElement("a");
      link.href = imgData;
      link.download = `musikkbingo-kort-${cardIndex + 1}.jpg`;
      link.click();
      setErrorMessage("");
    } catch (error) {
      console.error("Feil ved generering av JPG:", error);
      setErrorMessage("Det oppstod en feil ved lagring av bildet.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 text-center max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Spotify Musikk-Bingo Generator</h1>
      
      <div className="bg-gray-100 p-4 rounded-lg mb-6">
        <div className="flex flex-col md:flex-row mb-4">
          <input
            type="text"
            placeholder="Spotify spilleliste-URL"
            value={playlistUrl}
            onChange={(e) => setPlaylistUrl(e.target.value)}
            className="border p-2 flex-grow rounded"
          />
          <button 
            onClick={fetchSpotifySongs} 
            className="bg-blue-500 hover:bg-blue-600 text-white p-2 mt-2 md:mt-0 md:ml-2 rounded"
            disabled={loading}
          >
            {loading ? "Henter..." : "Hent sanger"}
          </button>
        </div>
        
        {songs.length > 0 && (
          <div className="text-sm text-gray-600 mb-2">
            Hentet {songs.length} sanger fra Spotify
          </div>
        )}
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Antall kort (1-50):</label>
            <input
              type="number"
              min="1"
              max="50"
              value={numCards}
              onChange={(e) => setNumCards(Math.min(50, Math.max(1, parseInt(e.target.value) || 1)))}
              className="border p-2 w-20 rounded"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Kortstørrelse:</label>
            <select
              value={cardSize}
              onChange={(e) => setCardSize(e.target.value)}
              className="border p-2 rounded"
            >
              <option value="small">Liten</option>
              <option value="medium">Medium</option>
              <option value="large">Stor</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Brettstørrelse:</label>
            <select
              value={gridSize}
              onChange={(e) => setGridSize(e.target.value)}
              className="border p-2 rounded"
            >
              <option value="3x3">3x3 (9 ruter)</option>
              <option value="3x4">3x4 (12 ruter)</option>
              <option value="4x4">4x4 (16 ruter)</option>
              <option value="4x5">4x5 (20 ruter)</option>
              <option value="5x5">5x5 (25 ruter)</option>
            </select>
          </div>
        </div>
        
        <div className="mt-4 flex flex-wrap gap-2 justify-center">
          <button 
            onClick={generateBingoCards} 
            className="bg-green-500 hover:bg-green-600 text-white p-2 rounded"
            disabled={loading || songs.length < (getGridDimensions(gridSize).rows * getGridDimensions(gridSize).cols)}
          >
            Generer Bingokort
          </button>
          
          {bingoCards.length > 0 && (
            <button 
              onClick={saveAllAsPDF} 
              className="bg-red-500 hover:bg-red-600 text-white p-2 rounded"
              disabled={loading}
            >
              Lagre alle som PDF
            </button>
          )}
        </div>
        
        {errorMessage && (
          <div className="mt-4 text-red-500">{errorMessage}</div>
        )}
      </div>

      {loading && (
        <div className="my-4 text-gray-600">
          Laster... Vennligst vent.
        </div>
      )}

      {bingoCards.length > 0 && (
        <div className={`grid ${getGridClass()} gap-8 mt-6`}>
          {bingoCards.map((card, cardIndex) => (
            <div key={cardIndex} className="card-container relative">
              <h2 className="text-lg font-bold mb-2">Kort #{cardIndex + 1}</h2>
              <div
                id={`bingoCard-${cardIndex}`}
                className={`grid border-2 border-black p-4 ${getCardSizeClass()} mx-auto bg-white rounded shadow-md print:shadow-none`}
                style={{ 
                  gridTemplateColumns: `repeat(${card.dimensions.cols}, 1fr)`,
                  gridTemplateRows: `auto repeat(${card.dimensions.rows}, 1fr)` // auto for header, 1fr for cells
                }}
              >
                {/* Header row */}
                {generateHeader(card.dimensions.cols)}
                
                {/* Kortets innhold */}
                {card.songs.map((song, cellIndex) => {
                  const isSelected = selectedCells[`${cardIndex}-${cellIndex}`];
                  
                  return (
                    <div
                      key={cellIndex}
                      className={`border p-2 cursor-pointer hover:bg-gray-100 ${
                        isSelected ? 'bg-green-200' : ''
                      } flex items-center justify-center text-center overflow-hidden aspect-square`}
                      onClick={() => toggleCell(cardIndex, cellIndex)}
                    >
                      <span>{song}</span>
                    </div>
                  );
                })}
              </div>
              
              <button
                onClick={() => saveCardAsJPG(cardIndex)}
                className="mt-2 bg-yellow-500 hover:bg-yellow-600 text-white p-1 rounded text-sm"
                disabled={loading}
              >
                Lagre som JPG
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}