import React, { useState } from 'react';
import { Search, Upload } from 'lucide-react';

function RecipeAI() {
  const [ingredients, setIngredients] = useState([]);
  const [currentIngredient, setCurrentIngredient] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [recipe, setRecipe] = useState(null);
  const [loading, setLoading] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);
  const [error, setError] = useState(null);
  const [imageError, setImageError] = useState(null);
  const [imageIngredients, setImageIngredients] = useState([]);
  const [cuisine, setCuisine] = useState('');
  const [dietaryRestrictions, setDietaryRestrictions] = useState('');
  const [youtubeEmbed, setYoutubeEmbed] = useState(null);
  const [videoLoading, setVideoLoading] = useState(false);
  const [videoError, setVideoError] = useState(null);

  const addIngredient = () => {
    if (currentIngredient.trim() && !ingredients.includes(currentIngredient.trim())) {
      setIngredients([...ingredients, currentIngredient.trim()]);
      setCurrentIngredient('');
    }
  };

  const removeIngredient = (ingredientToRemove) => {
    setIngredients(ingredients.filter(ing => ing !== ingredientToRemove));
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedImage(URL.createObjectURL(file));
      setImageFile(file);
      setImageIngredients([]);
      setImageError(null);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      addIngredient();
    }
  };

  const analyzeImage = async () => {
    if (!imageFile) {
      setImageError('Please select an image first');
      return;
    }

    setImageLoading(true);
    setImageError(null);

    try {
      // Create a FormData object to send the image file
      const formData = new FormData();
      formData.append('image', imageFile);

      // Send the image to the backend for analysis
      const response = await fetch('http://localhost:5007/api/analyze-image', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || 'Failed to analyze image');
      }

      const data = await response.json();
      
      if (!data.ingredients || data.ingredients.length === 0) {
        throw new Error('No ingredients detected in the image');
      }
      
      setImageIngredients(data.ingredients);
      
      // Add detected ingredients to the ingredient list
      const uniqueIngredients = [...new Set([...ingredients, ...data.ingredients])];
      setIngredients(uniqueIngredients);
      
      // Automatically generate recipe after successful ingredient detection
      await generateRecipeFromImageIngredients(uniqueIngredients);
      
    } catch (err) {
      console.error('Error analyzing image:', err);
      setImageError(`Failed to analyze image: ${err.message}`);
    } finally {
      setImageLoading(false);
    }
  };

  // New function to generate recipe after image analysis
  const generateRecipeFromImageIngredients = async (detectedIngredients) => {
    if (detectedIngredients.length === 0) {
      setError('No ingredients detected to generate a recipe');
      return;
    }

    setLoading(true);
    setError(null);
    setYoutubeEmbed(null); // Reset YouTube embed when generating a new recipe

    try {
      const response = await fetch('http://localhost:5007/api/generate-recipe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ingredients: detectedIngredients.join(', '),
          cuisine: cuisine || 'Any',
          dietaryRestrictions: dietaryRestrictions || 'None'
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || 'Failed to generate recipe');
      }

      const data = await response.json();
      if (!data.recipe) {
        throw new Error('No recipe received from the server');
      }
      
      setRecipe(data.recipe);
      
      // Extract recipe name and find a video for it
      let recipeName = '';
      const recipeLines = data.recipe.split('\n');
      for (const line of recipeLines) {
        if (line.includes('Recipe Name:') || line.match(/^#\s*/) || 
            (line.trim() && !line.includes(':') && recipeLines.indexOf(line) < 5)) {
          recipeName = line.replace(/Recipe Name:|^#\s*/, '').trim();
          break;
        }
      }
      
      // If we couldn't find a clearly marked recipe name, use the first line
      if (!recipeName && recipeLines.length > 0) {
        recipeName = recipeLines[0].trim();
      }
      
      if (recipeName) {
        findRecipeVideo(recipeName);
      }
    } catch (err) {
      console.error('Error:', err);
      setError(`Failed to generate recipe: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Function to find a YouTube video for the recipe
  const findRecipeVideo = async (recipeName) => {
    if (!recipeName) return;
    
    setVideoLoading(true);
    setVideoError(null);
    
    try {
      // Extract main ingredients for better video search
      const mainIngredients = ingredients.slice(0, 5).join(', ');
      
      const response = await fetch('http://localhost:5007/api/find-recipe-video', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          recipeName,
          ingredients: mainIngredients, 
          cuisine
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || 'Failed to find recipe video');
      }
      
      const data = await response.json();
      
      // Use the YouTube search API format that's more reliable
      const searchQuery = data.searchQuery || `${recipeName} recipe tutorial`;
      
      // Use a reliable direct embed format
      setYoutubeEmbed(`https://www.youtube-nocookie.com/embed?search=${encodeURIComponent(searchQuery)}`);
    } catch (err) {
      console.error('Error finding recipe video:', err);
      setVideoError(`Failed to find recipe video: ${err.message}`);
      
      // Fallback to a direct search using recipe name
      const fallbackQuery = encodeURIComponent(`${recipeName} recipe tutorial cooking`);
      setYoutubeEmbed(`https://www.youtube-nocookie.com/embed?search=${fallbackQuery}`);
    } finally {
      setVideoLoading(false);
    }
  };

  const addDetectedIngredient = (ingredient) => {
    if (!ingredients.includes(ingredient)) {
      setIngredients([...ingredients, ingredient]);
    }
  };

  const generateRecipe = async () => {
    if (ingredients.length === 0) {
      setError('Please add at least one ingredient');
      return;
    }

    setLoading(true);
    setError(null);
    setYoutubeEmbed(null); // Reset YouTube embed when generating a new recipe

    try {
      const response = await fetch('http://localhost:5007/api/generate-recipe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ingredients: ingredients.join(', '),
          cuisine: cuisine || 'Any',
          dietaryRestrictions: dietaryRestrictions || 'None'
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || 'Failed to generate recipe');
      }

      const data = await response.json();
      if (!data.recipe) {
        throw new Error('No recipe received from the server');
      }
      
      setRecipe(data.recipe);
      
      // Extract recipe name and find a video for it
      let recipeName = '';
      const recipeLines = data.recipe.split('\n');
      for (const line of recipeLines) {
        if (line.includes('Recipe Name:') || line.match(/^#\s*/) || 
            (line.trim() && !line.includes(':') && recipeLines.indexOf(line) < 5)) {
          recipeName = line.replace(/Recipe Name:|^#\s*/, '').trim();
          break;
        }
      }
      
      // If we couldn't find a clearly marked recipe name, use the first line
      if (!recipeName && recipeLines.length > 0) {
        recipeName = recipeLines[0].trim();
      }
      
      if (recipeName) {
        findRecipeVideo(recipeName);
      }
    } catch (err) {
      console.error('Error:', err);
      setError(`Failed to generate recipe: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Header with background image */}
      <div 
        className="relative h-72 bg-cover bg-center flex flex-col items-center justify-center text-white text-center p-4"
        style={{
          backgroundImage: 'linear-gradient(rgba(0,0,0,0.6), rgba(0,0,0,0.7)), url("https://images.unsplash.com/photo-1543339308-43e59d6b73a6?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=1470&q=80")',
          backgroundBlendMode: 'overlay',
        }}
      >
        <div className="flex items-center animate-[fadeIn_0.8s_ease]">
          <img 
            src="https://th.bing.com/th/id/OIP.aYyxt8z7jmsTWP16eYdYfAHaHa?rs=1&pid=ImgDetMain"
            alt="Recipe AI Logo" 
            className="w-16 h-16 mr-3 rounded-full border-2 border-white shadow-lg"
          />
          <h1 className="text-4xl font-bold">Foodie AI <span className="text-yellow-300">✨</span></h1>
        </div>
        <p className="mt-6 max-w-xl text-lg px-6 py-3 bg-black bg-opacity-40 rounded-full shadow-lg backdrop-blur-sm border border-gray-200 border-opacity-20">
          <span className="text-white font-medium">Transform your ingredients</span>
          <span className="text-[#FFD700] font-semibold"> into delicious recipes </span>
          <span className="text-gradient bg-clip-text bg-gradient-to-r from-cyan-300 to-purple-300 font-medium">with the power of AI</span>
        </p>
        <div className="absolute bottom-0 left-0 w-full overflow-hidden">
          <svg data-name="Layer 1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 120" preserveAspectRatio="none" className="w-full h-16 text-white">
            <path d="M321.39,56.44c58-10.79,114.16-30.13,172-41.86,82.39-16.72,168.19-17.73,250.45-.39C823.78,31,906.67,72,985.66,92.83c70.05,18.48,146.53,26.09,214.34,3V0H0V27.35A600.21,600.21,0,0,0,321.39,56.44Z" fill="currentColor"></path>
          </svg>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-12">
        <div className="grid md:grid-cols-2 gap-10">
          {/* Ingredients Section */}
          <div className="bg-white shadow-xl rounded-xl p-8 transition-all hover:shadow-2xl">
            <h2 className="text-2xl font-semibold mb-6 flex items-center text-gray-800">
              <Search className="mr-3 text-[var(--primary-color)]" /> Find Recipes by Ingredients
            </h2>
            
            <div className="flex mb-6">
              <input 
                type="text" 
                value={currentIngredient}
                onChange={(e) => setCurrentIngredient(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Add an ingredient"
                className="flex-grow px-4 py-3 border rounded-l-xl focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)]"
              />
              <button 
                onClick={addIngredient}
                className="bg-[var(--primary-color)] text-white px-5 py-3 rounded-r-xl hover:bg-[var(--primary-hover)] transition-colors"
              >
                +
              </button>
            </div>
            
            <div className="flex flex-wrap gap-2 mb-6 min-h-[60px]">
              {ingredients.map((ing) => (
                <span 
                  key={ing} 
                  className="bg-orange-100 text-orange-800 px-3 py-1.5 rounded-full text-sm flex items-center"
                >
                  {ing}
                  <button 
                    onClick={() => removeIngredient(ing)}
                    className="ml-2 text-orange-500 hover:text-orange-700 transition-colors"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>

            {/* Cuisine and Dietary Restrictions inputs */}
            <div className="mb-5">
              <label className="block text-gray-700 text-sm font-bold mb-2">
                Cuisine Type (Optional)
              </label>
              <input
                type="text"
                value={cuisine}
                onChange={(e) => setCuisine(e.target.value)}
                placeholder="e.g., Italian, Indian, Mexican"
                className="w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)]"
              />
            </div>

            <div className="mb-8">
              <label className="block text-gray-700 text-sm font-bold mb-2">
                Dietary Restrictions (Optional)
              </label>
              <input
                type="text"
                value={dietaryRestrictions}
                onChange={(e) => setDietaryRestrictions(e.target.value)}
                placeholder="e.g., vegetarian, gluten-free, low-carb"
                className="w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)]"
              />
            </div>

            <button 
              onClick={generateRecipe}
              disabled={loading || ingredients.length === 0}
              className="w-full bg-[var(--primary-color)] text-white py-3 rounded-xl hover:bg-[var(--primary-hover)] transition-colors disabled:bg-gray-400 font-medium"
            >
              {loading ? 'Generating...' : 'Generate Recipe'}
            </button>

            {error && (
              <div className="mt-4 text-red-500 text-center">
                {error}
              </div>
            )}
          </div>

          {/* Image Upload Section */}
          <div className="bg-white shadow-xl rounded-xl p-8 transition-all hover:shadow-2xl">
            <h2 className="text-2xl font-semibold mb-6 flex items-center text-gray-800">
              <Upload className="mr-3 text-[var(--secondary-color)]" /> Analyze Food Image
            </h2>
            
            <div className="mb-6">
              <label 
                htmlFor="food-image-upload" 
                className="block w-full p-8 border-2 border-dashed border-gray-300 rounded-xl text-center cursor-pointer hover:border-[var(--secondary-color)] transition-colors"
              >
                <div className="flex flex-col items-center">
                  <Upload className="w-10 h-10 text-[var(--secondary-color)] mb-3" />
                  <p className="text-gray-600 mb-2">
                    {selectedImage ? "Change selected image" : "Drag and drop or click to upload"}
                  </p>
                  <p className="text-xs text-gray-500">Supported formats: JPG, PNG, JPEG</p>
                </div>
                <input 
                  id="food-image-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </label>
            </div>

            {selectedImage && (
              <div className="mb-6 overflow-hidden rounded-xl">
                <img 
                  src={selectedImage} 
                  alt="Selected food" 
                  className="w-full h-64 object-cover rounded-xl transform hover:scale-105 transition-transform duration-500"
                />
              </div>
            )}

            <button 
              onClick={analyzeImage}
              disabled={imageLoading || !imageFile}
              className="w-full bg-[var(--secondary-color)] text-white py-3 rounded-xl hover:bg-[#27a89d] transition-colors disabled:bg-gray-400 font-medium"
            >
              {imageLoading ? 'Analyzing...' : 'Analyze Image'}
            </button>

            {imageLoading && (
              <div className="mt-6 text-center text-gray-600">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--secondary-color)] mb-2"></div>
                <p>Analyzing image for ingredients...</p>
                {imageIngredients.length > 0 && (
                  <p className="mt-2 text-[var(--primary-color)]">Generating recipe from detected ingredients...</p>
                )}
              </div>
            )}

            {imageError && (
              <div className="mt-6 text-red-500 text-center p-4 bg-red-50 rounded-xl">
                {imageError}
              </div>
            )}

            {imageIngredients.length > 0 && (
              <div className="mt-6 p-4 bg-green-50 rounded-xl">
                <h3 className="font-medium text-green-800 mb-3">Detected Ingredients:</h3>
                <div className="flex flex-wrap gap-2">
                  {imageIngredients.map((ing) => (
                    <span 
                      key={ing} 
                      className="bg-green-100 text-green-800 px-3 py-1.5 rounded-full text-sm"
                    >
                      {ing}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recipe Display */}
      {recipe && (
        <div className="mt-16 animate-[fadeIn_0.8s_ease]">
          <h2 className="text-3xl font-bold mb-8 text-center text-gray-800 border-b pb-4">Your AI-Generated Recipe</h2>
          
          <div className="bg-white shadow-xl rounded-xl overflow-hidden">
            {/* Recipe Content */}
            <div className="p-8">
              {/* Recipe Card Header */}
              <div className="recipe-header mb-10">
                {(() => {
                  // Extract recipe name
                  let recipeName = '';
                  const recipeLines = recipe.split('\n');
                  for (const line of recipeLines) {
                    if (line.includes('Recipe Name:') || line.match(/^#\s*/) || 
                        (line.trim() && !line.includes(':') && recipeLines.indexOf(line) < 5)) {
                      recipeName = line.replace(/Recipe Name:|^#\s*/, '').trim();
                      break;
                    }
                  }
                  
                  // If no recipe name found, use first line
                  if (!recipeName && recipeLines.length > 0) {
                    recipeName = recipeLines[0].trim();
                  }
                  
                  return (
                    <div className="text-center">
                      <h1 className="text-4xl font-bold text-[var(--primary-color)] mb-3">{recipeName}</h1>
                      <div className="w-32 h-1 bg-[var(--primary-color)] mx-auto rounded-full mb-6"></div>
                      
                      {/* Recipe Quick Info */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 my-6 bg-orange-50 p-5 rounded-lg">
                        {recipe.split('\n').map((line, idx) => {
                          if (line.includes('Cooking Time:') || line.includes('Cook Time:')) {
                            return (
                              <div key={`time-${idx}`} className="flex flex-col items-center justify-center p-3">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-[var(--primary-color)] mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <span className="font-semibold">Cooking Time</span>
                                <span className="text-center">{line.split(':')[1]?.trim() || '30-40 minutes'}</span>
                              </div>
                            );
                          }
                          if (line.includes('Servings:')) {
                            return (
                              <div key={`servings-${idx}`} className="flex flex-col items-center justify-center p-3">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-[var(--primary-color)] mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                </svg>
                                <span className="font-semibold">Servings</span>
                                <span className="text-center">{line.split(':')[1]?.trim() || '4 servings'}</span>
                              </div>
                            );
                          }
                          if (line.includes('Dietary Information:') || line.includes('Dietary:')) {
                            return (
                              <div key={`diet-${idx}`} className="flex flex-col items-center justify-center p-3">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-[var(--primary-color)] mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                </svg>
                                <span className="font-semibold">Dietary</span>
                                <span className="text-center">{line.split(':')[1]?.trim() || cuisine || 'Standard'}</span>
                              </div>
                            );
                          }
                          return null;
                        })}
                      </div>
                    </div>
                  );
                })()}
              </div>
              
              {/* Main Recipe Content - 2 Column Layout */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: Ingredients */}
                <div className="lg:col-span-1">
                  <div className="sticky top-4">
                    <div className="bg-gradient-to-r from-orange-50 to-amber-50 rounded-xl p-6 shadow-sm mb-6">
                      <h3 className="text-2xl font-semibold mb-4 flex items-center text-gray-800">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2 text-[var(--primary-color)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                        Ingredients
                      </h3>
                      
                      <div className="space-y-2">
                        {(() => {
                          // Extract ingredients section
                          const ingredientsMatch = recipe.match(/Ingredients:?([\s\S]*?)(?=Instructions:|Directions:|Steps:|$)/i);
                          if (ingredientsMatch && ingredientsMatch[1]) {
                            const ingredientLines = ingredientsMatch[1].trim().split('\n');
                            return ingredientLines.map((ingredient, idx) => {
                              if (!ingredient.trim()) return null;
                              
                              return (
                                <div key={idx} className="flex items-center py-1 border-b border-gray-100 last:border-b-0">
                                  <div className="w-2 h-2 rounded-full bg-[var(--primary-color)] mr-3 flex-shrink-0"></div>
                                  <span className="text-gray-700">{ingredient.trim().replace(/^-\s*/, '')}</span>
                                </div>
                              );
                            });
                          }
                          
                          // Fallback if no clear ingredients section
                          return ingredients.map((ingredient, idx) => (
                            <div key={idx} className="flex items-center py-1 border-b border-gray-100 last:border-b-0">
                              <div className="w-2 h-2 rounded-full bg-[var(--primary-color)] mr-3 flex-shrink-0"></div>
                              <span className="text-gray-700">{ingredient}</span>
                            </div>
                          ));
                        })()}
                      </div>
                    </div>
                    
                    {/* Nutritional Information Card */}
                    {recipe.includes('Nutritional Information') && (
                      <div className="bg-gray-50 p-6 rounded-xl border border-gray-200 mt-6">
                        <h3 className="text-xl font-semibold mb-4 text-gray-800 flex items-center">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2 text-[var(--primary-color)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                          Nutrition Facts
                        </h3>
                        <div className="grid grid-cols-2 gap-3">
                          {['Calories', 'Protein', 'Fat', 'Carbs', 'Fiber'].map(nutrient => {
                            const regex = new RegExp(`${nutrient}s?:?\\s*([\\d-]+)(?:g|\\s*|kcal)`, 'i');
                            const match = recipe.match(regex);
                            if (match) {
                              return (
                                <div key={nutrient} className="bg-white p-3 rounded-lg shadow-sm text-center">
                                  <div className="text-xs uppercase text-gray-500">{nutrient}</div>
                                  <div className="font-bold text-[var(--primary-color)] text-lg">
                                    {match[1]}{nutrient.toLowerCase() !== 'calories' ? 'g' : ''}
                                  </div>
                                </div>
                              );
                            }
                            return null;
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Right Column: Instructions & Others */}
                <div className="lg:col-span-2">
                  {/* Instructions Section */}
                  <div className="mb-8 bg-white rounded-xl p-6 shadow-sm">
                    <h3 className="text-2xl font-semibold mb-4 flex items-center text-gray-800 border-b pb-3">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2 text-[var(--primary-color)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                      Instructions
                    </h3>
                    
                    {(() => {
                      // Extract instructions section
                      const instructionsMatch = recipe.match(/(?:Instructions:|Directions:|Steps:)([\s\S]*?)(?=Tips|Variations|Nutritional|$)/i);
                      if (instructionsMatch && instructionsMatch[1]) {
                        const instructionLines = instructionsMatch[1].trim().split('\n');
                        
                        // Process instructions to remove empty lines and numbering
                        const cleanedInstructions = instructionLines
                          .filter(line => line.trim())
                          .map(line => line.replace(/^\d+\.?\s*/, '').trim());
                        
                        return (
                          <ol className="list-decimal ml-6 space-y-4">
                            {cleanedInstructions.map((step, idx) => (
                              <li key={idx} className="pl-2 pb-4 border-b border-gray-100 last:border-b-0 last:pb-0">
                                <span className="text-gray-700">{step}</span>
                              </li>
                            ))}
                          </ol>
                        );
                      }
                      
                      // Fallback if no clear instructions section
                      return (
                        <p className="text-gray-500 italic">
                          Use the ingredients to prepare your dish according to your preferred cooking method.
                        </p>
                      );
                    })()}
                  </div>
                  
                  {/* Tips and Variations Section */}
                  {recipe.includes('Tips') || recipe.includes('Variations') ? (
                    <div className="mb-8 bg-gray-50 rounded-xl p-6 shadow-sm">
                      <h3 className="text-xl font-semibold mb-4 text-gray-800 flex items-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2 text-[var(--primary-color)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                        Tips &amp; Variations
                      </h3>
                      
                      {(() => {
                        // Extract tips and variations section
                        const tipsMatch = recipe.match(/(?:Tips|Variations)([\s\S]*?)(?=Nutritional|$)/i);
                        if (tipsMatch && tipsMatch[1]) {
                          const tipLines = tipsMatch[1].trim().split('\n');
                          
                          return (
                            <ul className="space-y-2">
                              {tipLines.filter(line => line.trim()).map((tip, idx) => (
                                <li key={idx} className="flex items-start py-1">
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-yellow-500 mr-2 mt-0.5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                  </svg>
                                  <span className="text-gray-700">{tip.replace(/^-\s*/, '')}</span>
                                </li>
                              ))}
                            </ul>
                          );
                        }
                        
                        return null;
                      })()}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* YouTube Video Section */}
      {recipe && youtubeEmbed && (
        <div className="container mx-auto px-4 py-8 mt-4">
          <div className="bg-white shadow-xl rounded-xl overflow-hidden">
            <div className="p-8">
              <div className="mt-6 border-t border-dashed border-gray-200 pt-10">
                <h3 className="text-2xl font-semibold mb-6 text-gray-800 flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-red-600 mr-3" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z" />
                  </svg>
                  Video Tutorial
                </h3>
                
                {videoLoading && (
                  <div className="flex justify-center items-center h-72 bg-gray-100 rounded-xl">
                    <div className="text-center">
                      <div className="inline-block animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-red-500 mb-4"></div>
                      <p className="text-gray-600">Finding video tutorial for your recipe...</p>
                    </div>
                  </div>
                )}
                
                {videoError && !youtubeEmbed && (
                  <div className="bg-red-50 text-red-600 p-6 rounded-xl mt-4 text-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-red-500 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p>{videoError}</p>
                    <button 
                      onClick={() => {
                        const recipeName = recipe.split('\n')[0]?.replace('Recipe Name:', '').trim();
                        if (recipeName) findRecipeVideo(recipeName);
                      }}
                      className="mt-4 bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition-colors"
                    >
                      Try Again
                    </button>
                  </div>
                )}
                
                {youtubeEmbed && !videoLoading && (
                  <div className="space-y-4">
                    <div className="aspect-w-16 aspect-h-9 rounded-xl overflow-hidden shadow-lg">
                      <iframe 
                        src={youtubeEmbed}
                        title="Recipe Tutorial Video"
                        className="w-full h-[480px] rounded-xl"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowFullScreen
                        referrerPolicy="strict-origin-when-cross-origin"
                      ></iframe>
                    </div>
                    
                    {/* Direct video link as backup */}
                    <div className="mt-2 text-center">
                      <p className="text-gray-600 text-sm">If the video isn't loading properly, try viewing it directly:</p>
                      <a 
                        href={`https://www.youtube.com/results?search_query=${encodeURIComponent(recipe?.split('\n')[0]?.replace('Recipe Name:', '').trim() + ' recipe tutorial')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block mt-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                      >
                        <div className="flex items-center">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z" />
                          </svg>
                          Watch on YouTube
                        </div>
                      </a>
                    </div>
                    
                    <div className="flex justify-center mt-4">
                      <button 
                        onClick={() => {
                          // Extract recipe name for YouTube search
                          let searchRecipeName = '';
                          if (recipe) {
                            const recipeLines = recipe.split('\n');
                            for (const line of recipeLines) {
                              if (line.includes('Recipe Name:') || line.match(/^#\s*/) || 
                                  (line.trim() && !line.includes(':') && recipeLines.indexOf(line) < 5)) {
                                searchRecipeName = line.replace(/Recipe Name:|^#\s*/, '').trim();
                                break;
                              }
                            }
                            // If we couldn't find a clearly marked recipe name, use the first line
                            if (!searchRecipeName && recipeLines.length > 0) {
                              searchRecipeName = recipeLines[0].trim();
                            }
                          }
                          
                          // Direct YouTube search
                          const searchQuery = searchRecipeName 
                            ? `${searchRecipeName} recipe tutorial`
                            : 'recipe tutorial cooking';
                            
                          window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(searchQuery)}`, '_blank');
                        }}
                        className="flex items-center text-red-600 hover:text-red-800 transition-colors"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                        View more videos on YouTube
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Info Section */}
      <div className="container mx-auto px-4 py-12">
        <div className="flex justify-center items-center text-center py-6 px-8 bg-gradient-to-r from-orange-50 to-amber-50 rounded-xl shadow-sm">
          <p className="text-gray-700 max-w-2xl">
            Enter ingredients you have on hand or upload a food image above to discover delicious recipe ideas tailored just for you. Foodie AI will analyze your ingredients and create a custom recipe complete with video tutorials.
          </p>
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-20 py-8 bg-gradient-to-r from-gray-800 to-gray-900 text-white">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center mb-6 md:mb-0">
              <img 
                src="https://th.bing.com/th/id/OIP.aYyxt8z7jmsTWP16eYdYfAHaHa?rs=1&pid=ImgDetMain"
                alt="Foodie AI Logo" 
                className="w-10 h-10 mr-3 rounded-full"
              />
              <span className="text-xl font-bold">Foodie AI</span>
            </div>

            <div className="text-center md:text-right">
              <p className="text-sm text-gray-400">© {new Date().getFullYear()} Foodie AI - AI-Powered Recipe Generator</p>
              <p className="text-xs mt-1 text-gray-500">Transform your ingredients into delicious meals</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default RecipeAI;