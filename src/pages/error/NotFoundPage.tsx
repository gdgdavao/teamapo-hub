import React from 'react';
import { Link } from 'react-router-dom';
import dinoSvg from '@assets/dino.svg';

const NotFoundPage: React.FC = () => {
	return (
		<div className="min-h-screen bg-white flex flex-col items-center justify-center px-6">
			{/* Big 404 title */}
			<div className="relative select-none" aria-hidden>
				<h1 className="text-[160px] leading-none font-black tracking-widest text-red-500">404</h1>
				{/* Dino SVG over the 0 */}
				<div className="absolute inset-0 flex items-center justify-center pointer-events-none">
					<img src={dinoSvg} alt="Dinosaur" className="h-24 w-auto animate-bounce" style={{ animationDuration: '2.2s' }} />
				</div>
			</div>


			{/* Little dust dots animation */}
			<div className="relative mt-6 h-6 w-64">
				<span className="dot" />
				<span className="dot" style={{ animationDelay: '0.15s' }} />
				<span className="dot" style={{ animationDelay: '0.3s' }} />
				<span className="dot" style={{ animationDelay: '0.45s' }} />
			</div>

			<style>{`
				@keyframes trail {
					0% { transform: translateX(0); opacity: 0; }
					5% { opacity: 1; }
					85% { opacity: 1; }
					100% { transform: translateX(250px); opacity: 0; }
				}
				.dot {
					position: absolute;
					left: 0;
					top: 50%;
					margin-top: -2px;
					width: 6px;
					height: 6px;
					background: #111827; /* gray-900 */
					animation: trail 1.8s linear infinite;
					border-radius: 1px;
				}
			`}</style>
      <p className="mt-6 text-4xl font-medium tracking-widest text-red-500">Nothing's here bud...</p>
      <Link to="/" className="btn-primary mt-8">Go back</Link>
		</div>
	);
};

export default NotFoundPage;