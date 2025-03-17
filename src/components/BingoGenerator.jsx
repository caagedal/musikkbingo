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
  const [gridSize, setGridSize] = useState("5x5");
  const [errorMessage, setErrorMessage] = useState("");

  // Helper function to get dimensions from gridSize value
  const getGridDimensions = (size) => {
    const [rows, cols] = size.split('x').map(num => parseInt(num, 10));
    return { rows, cols };
  };

  // Bestem maksimal tekstlengde basert på gridstørrelse - bruker large
  const getMaxTextLength = (gridSize) => {
    const sizes = {
      "3x3": 45,
      "3x4": 40,
      "4x4": 35,
      "4x5": 32,
      "5x5": 28
    };
    
    return sizes[gridSize] || 28; // Standard 28 tegn hvis ikke spesifisert
  };

  // Helper function to manage text display without truncation
  const prepareSongTitle = (title) => {
    if (!title) return "";
    return title;
  };

  // Bestem størrelsen på kortene - alltid large nå
  const getCardSizeClass = () => {
    return "w-full max-w-a4 card-large"; // A4-optimalisert størrelse
  };

  // Bestem antall kort per rad i layouten - alltid 1 rad (for large kort)
  const getGridClass = () => {
    return "grid-cols-1"; // For large-kortstørrelse
  };

  // Add a resize observer to adjust text sizes whenever window is resized
  useEffect(() => {
    // Log status when bingoCards changes for debugging
    console.log("bingoCards updated:", bingoCards);
    
    // Add text auto-sizing after cards render
    if (bingoCards.length > 0) {
      setTimeout(() => {
        adjustTextSizes();
      }, 100);
      
      // Set up resize observer
      const resizeObserver = new ResizeObserver(() => {
        adjustTextSizes();
      });
      
      // Observe the container element
      const container = document.querySelector('.card-container');
      if (container) {
        resizeObserver.observe(container);
      }
      
      // Clean up
      return () => {
        if (container) {
          resizeObserver.unobserve(container);
        }
        resizeObserver.disconnect();
      };
    }
  }, [bingoCards]);
  
  // Function to dynamically adjust text sizes to fit cells
  const adjustTextSizes = () => {
    const cells = document.querySelectorAll('.cell-text');
    cells.forEach(cell => {
      const parent = cell.parentElement;
      if (!parent) return;
      
      const parentWidth = parent.offsetWidth;
      const parentHeight = parent.offsetHeight;
      
      // Start with the current font size
      let fontSize = parseFloat(window.getComputedStyle(cell).fontSize);
      cell.style.fontSize = `${fontSize}px`;
      
      // Check if text overflows and reduce size until it fits
      while (
        (cell.scrollWidth > parentWidth || cell.scrollHeight > parentHeight) && 
        fontSize > 5 // Set a minimum size limit
      ) {
        fontSize -= 0.5;
        cell.style.fontSize = `${fontSize}px`;
      }
    });
  };

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
      console.error("Error fetching access token:", error);
      setErrorMessage("Could not fetch Spotify access token. Check your API keys.");
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
      
      // Fetch all songs from the playlist (handles playlists with more than 100 songs)
      while (nextUrl) {
        const response = await fetch(nextUrl, { 
          headers: { Authorization: `Bearer ${accessToken}` } 
        });
        
        if (!response.ok) {
          throw new Error(`API responded with status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.items) {
          allTracks = [...allTracks, ...data.items];
        }
        
        nextUrl = data.next;
      }
      
      // Filter out null tracks and get ONLY the song title (no artist)
      const trackList = allTracks
        .filter(item => item.track)
        .map(item => item.track.name);
      
      setSongs(trackList);
      setErrorMessage("");
      
      console.log(`Hentet ${trackList.length} sanger fra Spotify`);
    } catch (error) {
      console.error("Error fetching playlist:", error);
      setErrorMessage(`Feil ved henting av spillelisten: ${error.message}`);
    } finally {
      setLoading(false);
    }
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
    console.log("generateBingoCards running...");
    
    const { rows, cols } = getGridDimensions(gridSize);
    const requiredSongs = rows * cols;
    
    console.log(`Need ${requiredSongs} songs, have ${songs.length} songs`);
    
    if (songs.length < requiredSongs) {
      setErrorMessage(`Du må ha minst ${requiredSongs} sanger! Du har ${songs.length} sanger.`);
      return;
    }
    
    setErrorMessage("");
    
    // Limit number of cards between 1 and 50
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
    
    console.log(`Generated ${newCards.length} bingo cards`);
    setBingoCards(newCards);
    setSelectedCells({}); // Reset selected cells
    
    // After cards are rendered, we need to adjust text sizes
    setTimeout(() => {
      adjustTextSizes();
    }, 300);
  };

  const toggleCell = (cardIndex, cellIndex) => {
    setSelectedCells(prev => {
      const key = `${cardIndex}-${cellIndex}`;
      const updatedCells = { ...prev };
      
      updatedCells[key] = !prev[key];
      
      return updatedCells;
    });
  };

  // Generate header based on number of columns
  const generateHeader = (cols) => {
    // Default header for 5 columns (B-I-N-G-O)
    const defaultHeader = ['B', 'I', 'N', 'G', 'O'];
    
    // For other sizes, we use the alphabet
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    
    let header;
    if (cols === 5) {
      header = defaultHeader;
    } else {
      header = alphabet.slice(0, cols).split('');
    }
    
    return header.map((letter, index) => (
      <div key={`header-${index}`} className="header-cell">
        {letter}
      </div>
    ));
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

  // Funksjonen for å lagre JPG er fjernet og vi beholder bare PDF-eksport

  return (
    <div className="p-4 text-center max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">Spotify Musikk-Bingo Generator</h1>
      
      <div className="generator-panel">
        <div className="mb-6">
          <div className="input-group">
            <label className="input-label">Spotify spilleliste-URL</label>
            <div className="flex flex-col md:flex-row gap-2">
              <input
                type="text"
                placeholder="https://open.spotify.com/playlist/..."
                value={playlistUrl}
                onChange={(e) => setPlaylistUrl(e.target.value)}
                className="input-field flex-grow"
              />
              <button 
                onClick={fetchSpotifySongs} 
                className="action-button whitespace-nowrap"
                disabled={loading}
              >
                {loading ? "Henter..." : "Hent sanger"}
              </button>
            </div>
          </div>
          
          {songs.length > 0 && (
            <div className="text-sm text-gray-600 mt-2">
              Hentet {songs.length} sanger fra Spotify
            </div>
          )}
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="input-group">
            <label className="input-label">Antall kort (1-50)</label>
            <input
              type="number"
              min="1"
              max="50"
              value={numCards}
              onChange={(e) => setNumCards(Math.min(50, Math.max(1, parseInt(e.target.value) || 1)))}
              className="input-field"
            />
          </div>
          
          <div className="input-group">
            <label className="input-label">Brettstørrelse</label>
            <select
              value={gridSize}
              onChange={(e) => setGridSize(e.target.value)}
              className="select-field w-full"
            >
              <option value="3x3">3x3 (9 ruter)</option>
              <option value="3x4">3x4 (12 ruter)</option>
              <option value="4x4">4x4 (16 ruter)</option>
              <option value="4x5">4x5 (20 ruter)</option>
              <option value="5x5">5x5 (25 ruter)</option>
            </select>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-4 justify-center">
          <button 
            onClick={generateBingoCards} 
            className="action-button"
            disabled={loading || songs.length < (getGridDimensions(gridSize).rows * getGridDimensions(gridSize).cols)}
          >
            Generer Bingokort
          </button>
          
          {bingoCards.length > 0 && (
            <button 
              onClick={saveAllAsPDF} 
              className="action-button"
              disabled={loading}
            >
              Lagre som PDF
            </button>
          )}
        </div>
        
        {errorMessage && (
          <div className="error-message mt-4">{errorMessage}</div>
        )}
      </div>

      {loading && (
        <div className="loading-indicator">
          Laster... Vennligst vent.
        </div>
      )}

      {bingoCards.length > 0 && (
        <div className={`grid ${getGridClass()} gap-8 mt-6`}>
          {bingoCards.map((card, cardIndex) => (
            <div key={cardIndex} className="card-container">
              <h2 className="card-title">Kort #{cardIndex + 1}</h2>
              <div
                id={`bingoCard-${cardIndex}`}
                className={`${getCardSizeClass()} mx-auto bingo-card`}
              >
                <div 
                  className="bingo-grid"
                  style={{ 
                    gridTemplateColumns: `repeat(${card.dimensions.cols}, 1fr)`,
                    gridTemplateRows: `auto repeat(${card.dimensions.rows}, 1fr)`
                  }}
                >
                  {/* Header row */}
                  {generateHeader(card.dimensions.cols)}
                  
                  {/* Card content */}
                  {card.songs.map((song, cellIndex) => {
                    const isSelected = selectedCells[`${cardIndex}-${cellIndex}`];
                    
                    return (
                      <div 
                        key={cellIndex} 
                        className="bingo-cell" 
                        onClick={() => toggleCell(cardIndex, cellIndex)}
                      >
                        <div className={`cell-content ${isSelected ? 'selected' : ''}`}>
                          <div className="cell-text text-auto-size">
                            {prepareSongTitle(song)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              
              {/* JPG-knappen er fjernet */}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}