import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import './App.css';
import cameraIcon from "./camera-icon.png";

const lib = require("blackjack-strategy");

// Helper function to get the card's numeric value
const getValue = (card: string): number =>
  ({ 'A': 1, 'J': 10, 'Q': 10, 'K': 10 }[card[0]] || parseInt(card[0], 10));

// Helper function to get the full name of a card
const getCardFullName = (card: string): string => {
  const rankMap: { [key: string]: string } = {
    'A': 'Ace', '2': '2', '3': '3', '4': '4', '5': '5', '6': '6', '7': '7', '8': '8', '9': '9', '10': '10',
    'J': 'Jack', 'Q': 'Queen', 'K': 'King'
  };

  const suitMap: { [key: string]: string } = {
    'S': 'Spades', 'H': 'Hearts', 'D': 'Diamonds', 'C': 'Clubs'
  };

  const rank = card.slice(0, -1); // Remove the suit part of the string
  const suit = card.slice(-1);    // Get the last character for the suit

  return `${rankMap[rank] || rank} of ${suitMap[suit] || ''}`;
};

// Main component
const App: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [playerCards, setPlayerCards] = useState<string[]>([]);
  const [dealerCard, setDealerCard] = useState<string | null>(null);
  const [noCardsDetected, setNoCardsDetected] = useState(false);
  const [recommendedMove, setRecommendedMove] = useState<string | null>(null);

  // Function to start the camera and video stream
  const startCamera = () => {
    setIsCameraOn(true);
    if (videoRef.current) {
      navigator.mediaDevices.getUserMedia({ video: true })
        .then((stream) => {
          videoRef.current!.srcObject = stream;
        })
        .catch((err) => {
          console.error("Error accessing the camera: ", err);
        });
    }
  };

  // Function to capture a frame from the video stream and send it to the API
  const captureFrameAndDetect = async () => {
    if (canvasRef.current && videoRef.current) {
      const canvas = canvasRef.current;
      const video = videoRef.current;

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Convert the captured frame to a base64 string
        const image = canvas.toDataURL('image/jpeg').split(',')[1]; // Remove the "data:image/jpeg;base64," part

        // Send the image to the Roboflow API
        try {
          const response = await axios({
            method: "POST",
            url: "https://detect.roboflow.com/playing-cards-ow27d/4",
            params: {
              api_key: "PCzT2sVcxkabbkFPF6Fb"
            },
            data: image,
            headers: {
              "Content-Type": "application/x-www-form-urlencoded"
            }
          });

          const result = response.data.predictions;

          let cardsFound = false;
          let allDetectedCards = result.map((item: any) => ({
            card: item["class"],
            y: item["y"]
          }));

          const playerCardArray: number[] = [];

          if (allDetectedCards.length > 0) {
            cardsFound = true;

            // Sort cards by y-coordinate
            allDetectedCards.sort((a: any, b: any) => a.y - b.y);

            // Assign the card with the smallest y-coordinate as the dealer's card
            const dealerCard = allDetectedCards[0].card;
            const playerCardsSet = new Set(
              allDetectedCards.slice(1).map((item: any) => item.card) // All other cards are the player's
            );

            const dealerCardValue = getValue(dealerCard);
            
            for (let card of playerCardsSet) {
              // @ts-ignore
              playerCardArray.push(getValue(card));
            }

            // @ts-ignore 
            setPlayerCards([...playerCardsSet]); // Update state with player's cards
            setDealerCard(dealerCard); // Update state with the dealer's card
          }

          setNoCardsDetected(!cardsFound); // If no cards are found, show the "no cards" message

          if (!noCardsDetected) {
            setRecommendedMove(lib.GetRecommendedPlayerAction(playerCardArray, dealerCard, 1, true, null));
          }

          console.log("Player's cards:", playerCardArray);
          console.log("Dealer's card:", dealerCard);
        } catch (error) {
          if (error instanceof Error) {
            console.log(error.message);
          } else {
            console.log("An unexpected error occurred");
          }
        }
      }
    }
  };

  // Periodically capture frames
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isCameraOn) {
      interval = setInterval(captureFrameAndDetect, 1000); // Capture a frame every second
    }
    return () => {
      if (interval) clearInterval(interval); // Cleanup interval when the component unmounts
    };
  }, [isCameraOn]);

  return (
    <div className="App">
      <div className='Header'>
        Card Master
      </div>
      <div className='Contents'>
        <div className='Camera'>
          <video ref={videoRef} width="640" height="480" autoPlay></video>
          <canvas ref={canvasRef} width="640" height="480" style={{ display: 'none' }}></canvas> {/* Hidden canvas for frame capture */}
        </div>
        <div className='Buttons'>
          <p>Ready to Play?</p>
          <button onClick={startCamera}>
            <img src={cameraIcon} alt="Camera Icon" />
            Start Camera
          </button>
          <div>
            <h3>Player's Detected Cards:</h3>
            {playerCards.length > 0 ? (
              <ul>
                {playerCards.map((card, index) => (
                  <li key={index}>{getCardFullName(card)}</li> // Display full card name
                ))}
              </ul>
            ) : (
              noCardsDetected && <p style={{ color: 'red' }}>Place cards in view</p> // Display this message if no cards are detected
            )}
          </div>
          <div>
            <h3>Dealer's Detected Card:</h3>
            {dealerCard ? (
              <p>{getCardFullName(dealerCard)}</p> // Display full card name
            ) : (
              noCardsDetected && <p style={{ color: 'red' }}>Place cards in view</p> // Display this message if no cards are detected
            )}
          </div>
          <div>
            <h3>Recommended Move: </h3>
            {
              recommendedMove ? (
                <p>{recommendedMove}</p>
              ) : (
                noCardsDetected && <p style={{color: 'red'}}>Place cards in view</p>
              )
            }
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
