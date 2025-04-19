import React from 'react'
import { TfiBasketball } from "react-icons/tfi"; 
import './Landing.css'
import { useNavigate } from 'react-router-dom';


const Landing = () => {
    const navigate = useNavigate();
  return (
    <div>
          <div className="app">
          <video className="video-bg" autoPlay loop muted playsInline>
                <source src="/LeBron-Edit.mp4" type="video/mp4" />
                Your browser does not support the video tag.
            </video>

            <div className='hoop'></div>

          <div className="basketball-shot">🏀</div>

          <div className="content-box">

                <div className='Title'>
                    H
                    <TfiBasketball className='ballIcon' />
                    <TfiBasketball className='ballIcon' />
                    pHelper
                </div>
                <div className='StartButtonWrapper'>
                    <button className='StartButton' onClick={() => navigate('/app')}>Start</button>
                </div>
            </div>
        </div>
    </div>
  )
}

export default Landing