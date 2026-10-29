import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import usePageTitle from '../../hooks/usePageTitle';
import dinoSvg from '@assets/dino.svg';

const NotFoundPage: React.FC = () => {
  usePageTitle({ title: 'Page Not Found' });
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  const handleGoBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }

    if (currentUser) {
      navigate('/');
    } else {
      navigate('/verify');
    }
  };

	return (
		<div className="min-h-screen bg-white flex flex-col items-center justify-center px-6">
			{/* Big 404 title */}
			<div className="relative select-none" aria-hidden>
				<h1 className="text-[160px] leading-none font-black tracking-widest text-error">404</h1>
				{/* Dino SVG over the 0. A slow sway, not a hop: `animate-bounce`
				    uses a squash-and-stretch curve that reads as dated, and it
				    fought the dot trail underneath it. */}
				<div className="absolute inset-0 flex items-center justify-center pointer-events-none">
					<img
						src={dinoSvg}
						alt="Dinosaur"
						className="h-24 w-auto animate-sway motion-reduce:animate-none"
					/>
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
				/* Sway: a small ease-in-out rotation. No overshoot, so it reads
				   as idle breathing rather than a spring. */
				@keyframes sway {
					0%, 100% { transform: rotate(-2.5deg); }
					50% { transform: rotate(2.5deg); }
				}
				.animate-sway {
					animation: sway 2.6s ease-in-out infinite;
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
      <p className="mt-6 text-4xl font-medium tracking-widest text-error">Nothing's here bud...</p>
      <button
        type="button"
        onClick={handleGoBack}
        className="btn-primary mt-8 min-h-[48px] inline-flex items-center justify-center"
      >
        Go back
      </button>
		</div>
	);
};

export default NotFoundPage;