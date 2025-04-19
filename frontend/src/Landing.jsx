import React from 'react'
import { TfiBasketball } from "react-icons/tfi"; 
import './Landing.css'


const Landing = () => {
  return (
    <div>
          <div className="app">

            <div className='hoop'>L</div>

          <div className="basketball-shot">🏀</div>

          <div className="content-box">

                <div className='Title'>
                    H
                    <TfiBasketball className='ballIcon' />
                    <TfiBasketball className='ballIcon' />
                    pHelper
                </div>
                <div className='StartButtonWrapper'>
                    <button className='StartButton'>Start</button>
                </div>
            </div>
        </div>
    </div>
  )
}

export default Landing