import React, { useState, useEffect } from 'react';
import { MessageSquare, Heart, ArrowLeft, Plus, MessageCircle, User, Send } from 'lucide-react';
import type { CommunityPost, CommunityComment } from '../types/schooldoc';

export const Community: React.FC = () => {
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [comments, setComments] = useState<CommunityComment[]>([]);
  
  // Navigation & Forms States
  const [activeCategory, setActiveCategory] = useState<'all' | 'free' | 'admin' | 'lessons' | 'market'>('all');
  const [selectedPost, setSelectedPost] = useState<CommunityPost | null>(null);
  const [isWriting, setIsWriting] = useState(false);
  
  // New Post Form States
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newPostCategory, setNewPostCategory] = useState<'free' | 'admin' | 'lessons' | 'market'>('free');
  const [newAuthor, setNewAuthor] = useState('익명교사');

  // New Comment Form State
  const [commentInput, setCommentInput] = useState('');

  // Initial Mock Posts load
  useEffect(() => {
    const loadedPosts = localStorage.getItem('schooldoc_community_posts');
    const loadedComments = localStorage.getItem('schooldoc_community_comments');
    
    if (loadedPosts && loadedComments) {
      setPosts(JSON.parse(loadedPosts));
      setComments(JSON.parse(loadedComments));
    } else {
      const mockPosts: CommunityPost[] = [
        {
          id: '1',
          title: '초임 교사인데 나이스 세특 마감 날짜가 언제쯤인가요?',
          content: '올해 6학년 담임을 처음 맡게 되었습니다. 보통 학기말 성적 처리와 학생 생활기록부 교과 세특 최종 마감일 기준이 학교마다 다른지, 아니면 도교육청 공통 지침이 있는지 선배님들의 조언 구합니다.',
          author: '초보쌤',
          category: 'admin',
          createdAt: '2026-07-25',
          likes: 8,
          commentsCount: 2,
        },
        {
          id: '2',
          title: '실감형 콘텐츠 활용한 5학년 과학 수업 PPT 나눔합니다!',
          content: '태양계 행성 크기 비교 수업할 때 AR 앱과 연동할 수 있는 프레젠테이션 자료입니다. 교실 모니터에 띄우고 스마트패드로 바로 사용 가능해요. 요긴하게 써주세요.',
          author: '테크선생',
          category: 'lessons',
          createdAt: '2026-07-24',
          likes: 24,
          commentsCount: 1,
        },
        {
          id: '3',
          title: '방학 일정이 앞당겨졌네요. 다들 방학 계획 어떻게 되시나요?',
          content: '저희 학교는 올해 석면 공사 때문에 방학을 1주일 일찍 시작하기로 결재가 났네요. 다들 방학 연수나 연가 사용 계획 있으신지 가볍게 떠들어봐요~',
          author: '가을하늘',
          category: 'free',
          createdAt: '2026-07-23',
          likes: 12,
          commentsCount: 3,
        },
      ];

      const mockComments: CommunityComment[] = [
        { id: '1', postId: '1', content: '보통 도교육청 성적 처리 기준 마감일이 정해져 있으나, 학교 내부 학업성적관리위원회 심의에 따라 세부 마감 일정은 차이가 있습니다. 교무부장님께 메신저로 기안 양식 문의해 보시는 것이 가장 안전합니다!', author: '부장교사', createdAt: '2026-07-25' },
        { id: '2', postId: '1', content: '보통 저희 학교는 방학식 1주일 전까지 최종 수정을 마감하더라고요. 화이팅입니다!', author: '응원맨', createdAt: '2026-07-25' },
        { id: '3', postId: '2', content: '자료 너무 알차네요! 다음 주 과학 시간에 꼭 활용해 보겠습니다. 정말 감사합니다.', author: '꿀벌교사', createdAt: '2026-07-24' },
      ];

      setPosts(mockPosts);
      setComments(mockComments);
      localStorage.setItem('schooldoc_community_posts', JSON.stringify(mockPosts));
      localStorage.setItem('schooldoc_community_comments', JSON.stringify(mockComments));
    }
  }, []);

  const handleCreatePost = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim()) {
      alert('제목과 내용을 모두 채워주세요.');
      return;
    }

    const newPost: CommunityPost = {
      id: Date.now().toString(),
      title: newTitle.trim(),
      content: newContent.trim(),
      author: newAuthor.trim() || '익명교사',
      category: newPostCategory,
      createdAt: new Date().toISOString().split('T')[0],
      likes: 0,
      commentsCount: 0,
    };

    const updated = [newPost, ...posts];
    setPosts(updated);
    localStorage.setItem('schooldoc_community_posts', JSON.stringify(updated));
    
    // Clear forms
    setNewTitle('');
    setNewContent('');
    setIsWriting(false);
  };

  const handleLikePost = (postId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = posts.map(p => {
      if (p.id === postId) {
        return { ...p, likes: p.likes + 1 };
      }
      return p;
    });
    setPosts(updated);
    localStorage.setItem('schooldoc_community_posts', JSON.stringify(updated));
    if (selectedPost && selectedPost.id === postId) {
      setSelectedPost({ ...selectedPost, likes: selectedPost.likes + 1 });
    }
  };

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPost || !commentInput.trim()) return;

    const newComment: CommunityComment = {
      id: Date.now().toString(),
      postId: selectedPost.id,
      content: commentInput.trim(),
      author: '익명쌤',
      createdAt: new Date().toISOString().split('T')[0],
    };

    const updatedComments = [...comments, newComment];
    setComments(updatedComments);
    localStorage.setItem('schooldoc_community_comments', JSON.stringify(updatedComments));

    // Update comment count on post
    const updatedPosts = posts.map(p => {
      if (p.id === selectedPost.id) {
        return { ...p, commentsCount: p.commentsCount + 1 };
      }
      return p;
    });
    setPosts(updatedPosts);
    localStorage.setItem('schooldoc_community_posts', JSON.stringify(updatedPosts));

    setSelectedPost({
      ...selectedPost,
      commentsCount: selectedPost.commentsCount + 1,
    });
    setCommentInput('');
  };

  const getCategoryLabel = (cat: string) => {
    switch (cat) {
      case 'free': return '자유';
      case 'admin': return '행정/공문';
      case 'lessons': return '수업나눔';
      case 'market': return '고민/상담';
      default: return '전체';
    }
  };

  const filteredPosts = posts.filter(p => {
    if (activeCategory === 'all') return true;
    return p.category === activeCategory;
  });

  const activeComments = comments.filter(c => selectedPost && c.postId === selectedPost.id);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      
      {/* 1. Detail Post View */}
      {selectedPost ? (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-100 shadow-sm animate-scale-up">
          <button
            onClick={() => setSelectedPost(null)}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 font-bold mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> 목록으로 돌아가기
          </button>

          <div className="border-b border-slate-100 pb-6 mb-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[10px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-bold">
                {getCategoryLabel(selectedPost.category)}
              </span>
              <span className="text-[10px] text-slate-400 font-semibold">{selectedPost.createdAt}</span>
            </div>

            <h3 className="font-extrabold text-slate-900 text-lg sm:text-xl mb-4 leading-snug">
              {selectedPost.title}
            </h3>

            <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
              <span className="flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-slate-400" /> {selectedPost.author}
              </span>
              <button
                onClick={(e) => handleLikePost(selectedPost.id, e)}
                className="flex items-center gap-1 text-slate-400 hover:text-rose-500 transition-colors"
              >
                <Heart className="w-4 h-4" /> 공감 {selectedPost.likes}
              </button>
            </div>
          </div>

          <p className="text-sm font-medium text-slate-700 leading-relaxed whitespace-pre-wrap mb-10">
            {selectedPost.content}
          </p>

          {/* Comment Section */}
          <div className="border-t border-slate-100 pt-8">
            <h4 className="font-extrabold text-slate-800 text-sm mb-6 flex items-center gap-1.5">
              <MessageCircle className="w-4.5 h-4.5 text-indigo-600" /> 댓글 ({activeComments.length})
            </h4>

            {activeComments.length > 0 ? (
              <div className="space-y-4 mb-8">
                {activeComments.map(c => (
                  <div key={c.id} className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                    <div className="flex justify-between items-center mb-2 text-[10px] font-bold text-slate-400">
                      <span>{c.author}</span>
                      <span>{c.createdAt}</span>
                    </div>
                    <p className="text-xs text-slate-700 font-medium leading-relaxed">{c.content}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-slate-400 text-xs font-semibold py-8 border-b border-slate-50 mb-8">
                등록된 첫 번째 댓글을 달아보세요!
              </div>
            )}

            {/* Comment Form */}
            <form onSubmit={handleAddComment} className="flex gap-2">
              <input
                type="text"
                placeholder="답글을 남겨 동료 교사에게 조언해 주세요..."
                value={commentInput}
                onChange={(e) => setCommentInput(e.target.value)}
                className="flex-1 border border-slate-200 rounded-xl px-4 py-2.5 text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
              />
              <button
                type="submit"
                className="bg-indigo-600 hover:bg-indigo-700 text-white p-2.5 rounded-xl transition shadow-sm"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      ) : isWriting ? (
        
        /* 2. Write Post Form */
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-100 shadow-sm animate-scale-up">
          <h3 className="font-extrabold text-slate-900 text-lg mb-6">✏️ 새로운 소통글 작성</h3>
          
          <form onSubmit={handleCreatePost} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-2">게시판 대분류</label>
              <div className="flex flex-wrap gap-2">
                {[
                  { id: 'free', label: '자유게시판' },
                  { id: 'admin', label: '행정/공문 Q&A' },
                  { id: 'lessons', label: '수업공유 자료실' },
                  { id: 'market', label: '교사 고민상담' }
                ].map(c => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setNewPostCategory(c.id as any)}
                    className={`text-xs px-3.5 py-2 rounded-xl font-bold border transition-colors ${
                      newPostCategory === c.id
                        ? 'bg-indigo-50 border-indigo-500 text-indigo-600'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 mb-2">필명/작성자</label>
              <input
                type="text"
                value={newAuthor}
                onChange={(e) => setNewAuthor(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-semibold focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 mb-2">제목</label>
              <input
                type="text"
                placeholder="제목을 입력하세요..."
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-xs font-semibold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 mb-2">내용</label>
              <textarea
                placeholder="선생님의 질문이나 정보를 자유롭게 공유해 주세요..."
                rows={6}
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                className="w-full border border-slate-200 rounded-2xl px-4 py-3 text-xs font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
              />
            </div>

            <div className="flex gap-2 justify-end pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsWriting(false)}
                className="text-xs text-slate-500 hover:text-slate-700 font-bold px-4 py-2.5"
              >
                작성 취소
              </button>
              <button
                type="submit"
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs px-5 py-2.5 rounded-xl shadow-sm transition"
              >
                글 올리기
              </button>
            </div>
          </form>
        </div>
      ) : (
        
        /* 3. Main Community List View */
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            {/* Filter Tabs */}
            <div className="flex gap-1.5 overflow-x-auto scrollbar-none py-1">
              {[
                { id: 'all', label: '전체' },
                { id: 'free', label: '자유' },
                { id: 'admin', label: '행정/공문 Q&A' },
                { id: 'lessons', label: '수업자료' },
                { id: 'market', label: '고민' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveCategory(tab.id as any)}
                  className={`text-xs px-3.5 py-1.5 rounded-xl border font-bold transition-all ${
                    activeCategory === tab.id
                      ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                      : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <button
              onClick={() => setIsWriting(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl transition flex items-center gap-1 shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" /> 글쓰기
            </button>
          </div>

          {/* Posts list */}
          <div className="space-y-4">
            {filteredPosts.length > 0 ? (
              filteredPosts.map(post => (
                <div
                  key={post.id}
                  onClick={() => setSelectedPost(post)}
                  className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm hover:shadow-md transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-2 mb-2.5">
                    <span className="text-[9px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-bold">
                      {getCategoryLabel(post.category)}
                    </span>
                    <span className="text-[9px] text-slate-400 font-semibold">{post.createdAt}</span>
                  </div>

                  <h4 className="font-extrabold text-sm sm:text-base text-slate-800 group-hover:text-indigo-600 transition-colors mb-2.5 leading-snug">
                    {post.title}
                  </h4>

                  <p className="text-xs text-slate-400 font-medium leading-relaxed line-clamp-2 mb-4">
                    {post.content}
                  </p>

                  <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 pt-3.5 border-t border-slate-50">
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3 text-slate-300" /> {post.author}
                    </span>
                    
                    <div className="flex items-center gap-3">
                      <button
                        onClick={(e) => handleLikePost(post.id, e)}
                        className="flex items-center gap-1 hover:text-rose-500"
                      >
                        <Heart className="w-3.5 h-3.5" /> 공감 {post.likes}
                      </button>
                      <span className="flex items-center gap-1">
                        <MessageSquare className="w-3.5 h-3.5 text-slate-300" /> 댓글 {post.commentsCount}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="bg-white border border-slate-100 rounded-3xl p-16 text-center text-slate-400 text-xs font-semibold leading-loose">
                등록된 게시글이 없습니다. <br />
                첫 번째 글을 작성해 보시겠어요?
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
