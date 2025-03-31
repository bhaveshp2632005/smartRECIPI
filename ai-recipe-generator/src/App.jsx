import React, { useEffect } from 'react'

import './App.css'
import RecipeAI from './component/recipefrontend'

function App() {
  useEffect(() => {
    document.title = 'Foodie AI';
  }, []);

  return (
    <>
    <RecipeAI />
    </>
  )
}

export default App
